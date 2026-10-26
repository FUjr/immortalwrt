/* SPDX-License-Identifier: GPL-2.0-only
 * Same-origin diagnostic HTTP proxy. Only its own transfer timeout is disabled.
 */
#define _GNU_SOURCE
#include "plugin.h"
#include "uhttpd.h"
#include <arpa/inet.h>
#include <errno.h>
#include <fcntl.h>
#include <libubox/blobmsg.h>
#include <netinet/in.h>
#include <stdlib.h>
#include <string.h>
#include <sys/socket.h>
#include <sys/un.h>
#include <unistd.h>
#ifndef DEBUG_SOCKET
#define DEBUG_SOCKET "/tmp/debuger/http.sock"
#endif
#define HIGH_WATER (128 * 1024)
#define LOW_WATER (64 * 1024)
struct debug_proxy {
  struct list_head list;
  struct client *client;
  struct ustream_fd upstream;
  int fd;
  struct uloop_timeout pump;
  size_t remaining;
  bool eof;
};
static LIST_HEAD(proxies);
static const struct uhttpd_ops *ops;
static void json_error(struct client *cl, int code, const char *summary,
                       const char *message) {
  cl->request.connection_close = true;
  ops->http_header(cl, code, summary);
  ustream_printf(cl->us, "Content-Type: application/json\r\nCache-Control: no-store\r\n\r\n");
  /* Messages are fixed literals owned by this module. */
  ops->chunk_printf(cl, "{\"error\":\"%s\"}", message);
  ops->request_done(cl);
}
static bool check_url(const char *url) {
  return url && (!strcmp(url, "/debuger/api") ||
                 !strcmp(url, "/debuger/upload/tool") ||
                 !strcmp(url, "/debuger/upload/remote") ||
                 !strncmp(url, "/debuger/download/", 18));
}
static void cleanup(struct client *cl) {
  struct debug_proxy *p = cl->dispatch.req_data;
  if (!p)
    return;
  cl->dispatch.req_data = NULL;
  list_del(&p->list);
  uloop_timeout_cancel(&p->pump);
  ustream_free(&p->upstream.stream);
  if (p->fd >= 0)
    close(p->fd);
  free(p);
}
static void close_fds(struct client *cl) {
  struct debug_proxy *p = cl->dispatch.req_data;
  if (p && p->fd >= 0) {
    close(p->fd);
    p->fd = -1;
  }
}
static void end_client(struct debug_proxy *p) {
  if (!p->client)
    return;
  /* Let the HTTP response drain before closing TLS or the downstream socket. */
  p->eof = true;
  if (!ustream_pending_data(p->client->us, true)) {
    p->client->us->eof = true;
    ustream_state_change(p->client->us);
  }
}
static void upstream_read(struct ustream *s, int bytes) {
  (void)bytes;
  struct debug_proxy *p = container_of(s, struct debug_proxy, upstream.stream);
  int len;
  char *data;
  while (p->client && (data = ustream_get_read_buf(s, &len)) && len > 0) {
    int pending = ustream_pending_data(p->client->us, true);
    if (pending >= HIGH_WATER) {
      ustream_set_read_blocked(s, true);
      break;
    }
    if (len > HIGH_WATER - pending)
      len = HIGH_WATER - pending;
    int n = ustream_write(p->client->us, data, len, true);
    if (n < 0) {
      end_client(p);
      break;
    }
    if (!n)
      break;
    ustream_consume(s, n);
  }
}
static void upstream_state(struct ustream *s) {
  struct debug_proxy *p = container_of(s, struct debug_proxy, upstream.stream);
  if (s->eof || s->write_error) {
    upstream_read(s, 0);
    if (!ustream_pending_data(s, false))
      end_client(p);
  }
}
static void downstream_write(struct client *cl) {
  struct debug_proxy *p = cl->dispatch.req_data;
  if (!p)
    return;
  if (ustream_pending_data(cl->us, true) < LOW_WATER) {
    ustream_set_read_blocked(&p->upstream.stream, false);
    upstream_read(&p->upstream.stream, 0);
    if (p->upstream.stream.eof &&
        !ustream_pending_data(&p->upstream.stream, false))
      p->eof = true;
  }
  if (p->eof && !ustream_pending_data(cl->us, true)) {
    cl->us->eof = true;
    ustream_state_change(cl->us);
  }
}
static struct debug_proxy *for_stream(struct ustream *s) {
  struct debug_proxy *p;
  list_for_each_entry(p, &proxies,
                      list) if (p->client && p->client->us == s) return p;
  return NULL;
}
static void downstream_read(struct ustream *s, int bytes) {
  (void)bytes;
  struct debug_proxy *p = for_stream(s);
  if (!p)
    return;
  int len;
  char *data;
  while (p->remaining && (data = ustream_get_read_buf(s, &len)) && len > 0) {
    if ((size_t)len > p->remaining)
      len = p->remaining;
    int pending = ustream_pending_data(&p->upstream.stream, true);
    if (pending >= HIGH_WATER) {
      ustream_set_read_blocked(s, true);
      return;
    }
    if (len > HIGH_WATER - pending)
      len = HIGH_WATER - pending;
    int n = ustream_write(&p->upstream.stream, data, len, true);
    if (n <= 0)
      return;
    p->remaining -= n;
    ustream_consume(s, n);
  }
  /* No HTTP pipelining; the backend closes after one response. */
  /* Keep reading enabled so an idle download still observes the peer FIN. */
}
static void pump_body(struct uloop_timeout *t) {
  struct debug_proxy *p = container_of(t, struct debug_proxy, pump);
  if (p->client)
    downstream_read(p->client->us, 0);
}
static void upstream_write(struct ustream *s, int bytes) {
  (void)bytes;
  struct debug_proxy *p = container_of(s, struct debug_proxy, upstream.stream);
  if (p->client && p->remaining && ustream_pending_data(s, true) < LOW_WATER) {
    ustream_set_read_blocked(p->client->us, false);
    downstream_read(p->client->us, 0);
  }
}
static int connect_backend(void) {
  int fd = socket(AF_UNIX, SOCK_STREAM | SOCK_CLOEXEC, 0);
  struct sockaddr_un a = {.sun_family = AF_UNIX};
  snprintf(a.sun_path, sizeof(a.sun_path), "%s", DEBUG_SOCKET);
  if (fd < 0 || connect(fd, (struct sockaddr *)&a, sizeof(a))) {
    if (fd >= 0)
      close(fd);
    return -1;
  }
  int flags = fcntl(fd, F_GETFL, 0);
  if (flags < 0 || fcntl(fd, F_SETFL, flags | O_NONBLOCK)) {
    close(fd);
    return -1;
  }
  return fd;
}
static bool tuple(struct client *cl, char *out, size_t size) {
  char peer[INET6_ADDRSTRLEN], local[INET6_ADDRSTRLEN];
  const void *pa, *la;
  int family = cl->peer_addr.family;
  uint16_t pp = cl->peer_addr.port, lp = cl->srv_addr.port;
  if (family != cl->srv_addr.family)
    return false;
  if (family == AF_INET) {
    pa = &cl->peer_addr.in;
    la = &cl->srv_addr.in;
  } else if (family == AF_INET6) {
    if (IN6_IS_ADDR_V4MAPPED(&cl->peer_addr.in6) &&
        IN6_IS_ADDR_V4MAPPED(&cl->srv_addr.in6)) {
      family = AF_INET;
      pa = cl->peer_addr.in6.s6_addr + 12;
      la = cl->srv_addr.in6.s6_addr + 12;
    } else {
      pa = &cl->peer_addr.in6;
      la = &cl->srv_addr.in6;
    }
  } else
    return false;
  if (!inet_ntop(family, pa, peer, sizeof(peer)) ||
      !inet_ntop(family, la, local, sizeof(local)))
    return false;
  snprintf(
      out, size,
      "not (tcp and ((src host %s and src port %u and dst host %s and dst port "
      "%u) or (src host %s and src port %u and dst host %s and dst port %u)))",
      peer, pp, local, lp, local, lp, peer, pp);
  return true;
}
static void handle(struct client *cl, char *url, struct path_info *pi) {
  (void)pi;
  bool get = !strncmp(url, "/debuger/download/", 18);
  if ((get && cl->request.method != UH_HTTP_MSG_GET) ||
      (!get && cl->request.method != UH_HTTP_MSG_POST) ||
      cl->request.transfer_chunked ||
      cl->request.content_length > 8 * 1024 * 1024) {
    json_error(cl, 400, "Bad Request", "Unsupported diagnostic request");
    return;
  }
  struct debug_proxy *p = calloc(1, sizeof(*p));
  if (!p) {
    json_error(cl, 503, "Unavailable", "Out of memory");
    return;
  }
  p->fd = connect_backend();
  if (p->fd < 0) {
    free(p);
    json_error(cl, 502, "Unavailable", "Diagnostic manager unavailable");
    return;
  }
  p->client = cl;
  p->remaining = get ? 0 : cl->request.content_length;
  list_add_tail(&p->list, &proxies);
  ustream_fd_init(&p->upstream, p->fd);
  p->upstream.stream.notify_read = upstream_read;
  p->upstream.stream.notify_write = upstream_write;
  p->upstream.stream.notify_state = upstream_state;
  cl->dispatch.req_data = p;
  cl->dispatch.req_free = cleanup;
  cl->dispatch.close_fds = close_fds;
  cl->dispatch.write_cb = downstream_write;
  cl->request.connection_close = true;
  /* Raw response proxy: DONE lets the core close cleanly on peer/backend EOF.
   */
  cl->state = CLIENT_STATE_DONE;
  uloop_timeout_cancel(&cl->timeout);
  cl->us->notify_read = downstream_read;
  ustream_printf(
      &p->upstream.stream,
      "%s %s HTTP/1.1\r\nContent-Length: %zu\r\nConnection: close\r\n",
      get ? "GET" : "POST", url, p->remaining);
  struct blob_attr *cur;
  unsigned int rem;
  blob_for_each_attr(cur, cl->hdr.head, rem) {
    if (!strcasecmp(blobmsg_name(cur), "x-debug-session"))
      ustream_printf(&p->upstream.stream, "X-Debug-Session: %s\r\n",
                     blobmsg_get_string(cur));
  }
  char exclude[512];
  if (tuple(cl, exclude, sizeof(exclude)))
    ustream_printf(&p->upstream.stream, "X-Debug-Exclude: %s\r\n", exclude);
  ustream_printf(&p->upstream.stream, "\r\n");
  /* Core sends 100 Continue and consumes the last header CRLF after dispatch.
   */
  p->pump.cb = pump_body;
  uloop_timeout_set(&p->pump, 0);
}
static struct dispatch_handler dispatch = {.check_url = check_url,
                                           .handle_request = handle};
static int init(const struct uhttpd_ops *o, struct config *c) {
  (void)c;
  ops = o;
  ops->dispatch_add(&dispatch);
  return 0;
}
struct uhttpd_plugin uhttpd_plugin = {.init = init};
