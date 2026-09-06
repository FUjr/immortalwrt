#!/bin/sh

set -eu

PACKAGE_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
GENERATOR="$PACKAGE_DIR/files/lib/wifi/mac80211.uc"

grep -Fq 'read_oem_wifi_default("misectel_ssid")' "$GENERATOR"
grep -Fq 'read_oem_wifi_default("misectel_key")' "$GENERATOR"
grep -Fq 'if (radio_exists(phy.path, macaddr, phy_name, radio.index))' "$GENERATOR"
grep -Fq 'load_oem_wifi_defaults();' "$GENERATOR"
grep -Fq 'defaults.ssid = oem_ssid' "$GENERATOR"
grep -Fq 'defaults.key = oem_key' "$GENERATOR"
grep -Fq 'defaults.encryption = "psk2"' "$GENERATOR"

radio_check_line="$(grep -nF 'if (radio_exists(phy.path, macaddr, phy_name, radio.index))' "$GENERATOR" | cut -d: -f1)"
oem_load_line="$(grep -nF 'load_oem_wifi_defaults();' "$GENERATOR" | cut -d: -f1)"
oem_apply_line="$(grep -nF 'if (oem_ssid || oem_key)' "$GENERATOR" | cut -d: -f1)"
[ "$radio_check_line" -lt "$oem_load_line" ]
[ "$oem_load_line" -lt "$oem_apply_line" ]

echo 'wifi OEM default generation checks passed'
