#!/bin/sh

# Kernel timer trigger continues while sysupgrade replaces userspace.
m16k43_clock_period() {
	local half_period="$1"
	local led=/sys/class/leds/m16k43:watchdog
	[ -d "$led" ] || return 0
	echo timer > "$led/trigger"
	echo "$half_period" > "$led/delay_on"
	echo "$half_period" > "$led/delay_off"
}
