/* uhttpd WebSocket reverse proxy for qmodem-voip browser media. */
#define _GNU_SOURCE
#include <arpa/inet.h>
#include <errno.h>
#include <fcntl.h>
#include <netinet/in.h>
#include <stdlib.h>
#include <sys/un.h>
#include <stdbool.h>
#include <stdio.h>
#include <string.h>
#include <sys/socket.h>
#include <syslog.h>
#include <unistd.h>

#include <libubox/blobmsg.h>
#include "uhttpd.h"
#include "plugin.h"

#define WS_PATH "/qmodem-voip/media"
#define WS_TARGET_ADDR "127.0.0.1"
#define WS_TARGET_PORT 9080
#define WS_TARGET_UNIX "/var/run/qmodem_voip/websocket.sock"

struct ws_proxy {
	struct list_head list;
	struct client *client;
	struct ustream_fd upstream;
	int upstream_fd;
	bool response_seen;
};

static LIST_HEAD(ws_proxies);
static const struct uhttpd_ops *ws_ops;

static bool ws_check_url(const char *url)
{
	const char *query;
	size_t length;

	if (!url)
		return false;
	query = strchr(url, '?');
	length = query ? (size_t)(query - url) : strlen(url);
	return length == sizeof(WS_PATH) - 1 && !strncmp(url, WS_PATH, length);
}

static const char *ws_header(struct client *cl, const char *name)
{
	struct blob_attr *cur;
	unsigned int rem;

	blob_for_each_attr(cur, cl->hdr.head, rem) {
		if (!strcasecmp(blobmsg_name(cur), name))
			return blobmsg_get_string(cur);
	}
	return NULL;
}

static void ws_client_error(struct client *cl, int code, const char *summary,
				    const char *message)
{
	if (!cl || !ws_ops || !ws_ops->client_error)
		return;
	ws_ops->client_error(cl, code, summary, "%s", message);
}

static void ws_proxy_free(struct client *cl)
{
	struct ws_proxy *proxy = cl->dispatch.req_data;

	if (!proxy)
		return;
	cl->dispatch.req_data = NULL;
	list_del(&proxy->list);
	proxy->client = NULL;
	ustream_free(&proxy->upstream.stream);
	if (proxy->upstream_fd >= 0)
		close(proxy->upstream_fd);
	free(proxy);
}

static void ws_proxy_close_fds(struct client *cl)
{
	struct ws_proxy *proxy = cl->dispatch.req_data;

	if (proxy && proxy->upstream_fd >= 0)
		close(proxy->upstream_fd), proxy->upstream_fd = -1;
}

static void ws_upstream_state(struct ustream *stream)
{
	struct ws_proxy *proxy = container_of(stream, struct ws_proxy, upstream.stream);
	struct client *cl = proxy->client;

	if (!cl)
		return;
	if (stream->eof || stream->write_error) {
		syslog(LOG_INFO, "qmodem websocket upstream closed: eof=%d write_error=%d",
			stream->eof, stream->write_error);
		cl->us->eof = true;
		ustream_state_change(cl->us);
	}
}

static void ws_upstream_read(struct ustream *stream, int bytes)
{
	struct ws_proxy *proxy = container_of(stream, struct ws_proxy, upstream.stream);
	struct client *cl = proxy->client;
	char *buffer;
	int length;

	(void)bytes;
	if (!cl)
		return;
	while ((buffer = ustream_get_read_buf(stream, &length)) && length > 0) {
		int written = ustream_write(cl->us, buffer, length, true);
		int pending = ustream_pending_data(cl->us, true);
		if (!proxy->response_seen) {
			char preview[256];
			size_t preview_length = (size_t)length < sizeof(preview) - 1U ?
				(size_t)length : sizeof(preview) - 1U;
			for (size_t i = 0; i < preview_length; i++)
				preview[i] = (buffer[i] >= 0x20 && buffer[i] <= 0x7e) ? buffer[i] : '.';
			preview[preview_length] = '\0';
			proxy->response_seen = true;
			syslog(LOG_INFO, "qmodem websocket upstream response received: %d bytes", length);
			syslog(LOG_INFO, "qmodem websocket response head: %s", preview);
		}
		syslog(LOG_INFO, "qmodem websocket downstream write: requested=%d written=%d pending=%d",
			length, written, pending);

		if (written < 0) {
			cl->us->eof = true;
			ustream_state_change(cl->us);
			return;
		}
		if (written == 0)
			return;
		ustream_consume(stream, written);
		if (pending > 256 * 1024) {
			ustream_set_read_blocked(stream, true);
			return;
		}
	}
}

static void ws_client_read(struct ustream *stream, int bytes)
{
	struct ws_proxy *proxy;
	struct client *cl = NULL;
	char *buffer;
	int length;

	(void)bytes;
	list_for_each_entry(proxy, &ws_proxies, list)
		if (proxy->client && proxy->client->us == stream) {
			cl = proxy->client;
			break;
		}
	if (!cl)
		return;
	while ((buffer = ustream_get_read_buf(stream, &length)) && length > 0) {
		int written = ustream_write(&proxy->upstream.stream, buffer, length, true);

		if (written < 0)
			return;
		if (written == 0)
			return;
		ustream_consume(stream, written);
	}
}

static void ws_upstream_write(struct ustream *stream, int bytes)
{
	struct ws_proxy *proxy = container_of(stream, struct ws_proxy, upstream.stream);

	(void)bytes;
	if (proxy->client && ustream_read_blocked(proxy->client->us) &&
	    ustream_pending_data(&proxy->upstream.stream, true) < 128 * 1024)
		ustream_set_read_blocked(proxy->client->us, false);
}

static int ws_connect_tcp_target(void)
{
	struct sockaddr_in address = { 0 };
	int flags;
	int fd;

	fd = socket(AF_INET, SOCK_STREAM | SOCK_CLOEXEC, 0);
	if (fd < 0)
		return -1;
	address.sin_family = AF_INET;
	address.sin_port = htons(WS_TARGET_PORT);
	if (inet_pton(AF_INET, WS_TARGET_ADDR, &address.sin_addr) != 1 ||
	    connect(fd, (struct sockaddr *)&address, sizeof(address)) < 0) {
		close(fd);
		return -1;
	}
	flags = fcntl(fd, F_GETFL, 0);
	if (flags < 0 || fcntl(fd, F_SETFL, flags | O_NONBLOCK) < 0) {
		close(fd);
		return -1;
	}
	return fd;
}

static int ws_connect_unix_target(void)
{
	struct sockaddr_un address = { 0 };
	int flags;
	int fd;

	fd = socket(AF_UNIX, SOCK_STREAM | SOCK_CLOEXEC, 0);
	if (fd < 0)
		return -1;
	address.sun_family = AF_UNIX;
	if (strlen(WS_TARGET_UNIX) >= sizeof(address.sun_path)) {
		close(fd);
		return -1;
	}
	strncpy(address.sun_path, WS_TARGET_UNIX, sizeof(address.sun_path) - 1U);
	if (connect(fd, (struct sockaddr *)&address, sizeof(address)) < 0) {
		close(fd);
		return -1;
	}
	flags = fcntl(fd, F_GETFL, 0);
	if (flags < 0 || fcntl(fd, F_SETFL, flags | O_NONBLOCK) < 0) {
		close(fd);
		return -1;
	}
	return fd;
}

static int ws_connect_target(void)
{
	int fd = ws_connect_unix_target();
	return fd >= 0 ? fd : ws_connect_tcp_target();
}

static void ws_send_request(struct ws_proxy *proxy, struct client *cl, const char *url)
{
	struct blob_attr *cur;
	unsigned int rem;
	const char *query;

	/* The public LuCI route is namespaced, while voipd serves /media. */
	query = strchr(url, '?');
	if (query)
		ustream_printf(&proxy->upstream.stream, "GET /media%s HTTP/1.1\r\n", query);
	else
		ustream_printf(&proxy->upstream.stream, "GET /media HTTP/1.1\r\n");
	blob_for_each_attr(cur, cl->hdr.head, rem) {
		const char *name = blobmsg_name(cur);
		if (!strcasecmp(name, "URL") || !strcasecmp(name, "host") ||
		    !strcasecmp(name, "connection") || !strcasecmp(name, "content-length"))
			continue;
		ustream_printf(&proxy->upstream.stream, "%s: %s\r\n", name,
			blobmsg_get_string(cur));
	}
	ustream_printf(&proxy->upstream.stream, "Host: %s:%d\r\nConnection: Upgrade\r\n\r\n",
		WS_TARGET_ADDR, WS_TARGET_PORT);
}

static void ws_handle_request(struct client *cl, char *url, struct path_info *pi)
{
	struct ws_proxy *proxy;
	const char *upgrade = ws_header(cl, "upgrade");
	const char *connection = ws_header(cl, "connection");

	(void)pi;
	if (cl->request.method != UH_HTTP_MSG_GET || !upgrade ||
	    strcasecmp(upgrade, "websocket") || !connection ||
	    !strcasestr(connection, "upgrade")) {
		ws_client_error(cl, 400, "Bad Request", "WebSocket upgrade required");
		return;
	}
	proxy = calloc(1, sizeof(*proxy));
	if (!proxy) {
		ws_client_error(cl, 503, "Service Unavailable", "WebSocket proxy unavailable");
		return;
	}
	proxy->client = cl;
	INIT_LIST_HEAD(&proxy->list);
	list_add_tail(&proxy->list, &ws_proxies);
	proxy->upstream_fd = ws_connect_target();
	if (proxy->upstream_fd < 0) {
		syslog(LOG_WARNING, "qmodem websocket backend connect failed");
		list_del(&proxy->list);
		free(proxy);
		ws_client_error(cl, 502, "Bad Gateway", "WebSocket media endpoint unavailable");
		return;
	}
	syslog(LOG_INFO, "qmodem websocket proxy connected");
	ustream_fd_init(&proxy->upstream, proxy->upstream_fd);
	proxy->upstream.stream.notify_read = ws_upstream_read;
	proxy->upstream.stream.notify_write = ws_upstream_write;
	proxy->upstream.stream.notify_state = ws_upstream_state;
	cl->dispatch.req_data = proxy;
	cl->dispatch.req_free = ws_proxy_free;
	cl->dispatch.close_fds = ws_proxy_close_fds;
	cl->request.connection_close = true;
	cl->state = CLIENT_STATE_DATA;
	uloop_timeout_cancel(&cl->timeout);
	cl->us->notify_read = ws_client_read;
	ws_send_request(proxy, cl, url);
}

static struct dispatch_handler ws_dispatch = {
	.check_url = ws_check_url,
	.handle_request = ws_handle_request,
};

static int ws_init(const struct uhttpd_ops *ops, struct config *config)
{
	(void)config;
	ws_ops = ops;
	ops->dispatch_add(&ws_dispatch);
	return 0;
}

struct uhttpd_plugin uhttpd_plugin = {
	.init = ws_init,
};
