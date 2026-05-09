#!/bin/sh
# Install a udev rule that lets members of the 'powermon' group read Intel RAPL
# energy counters from /sys/class/powercap/intel-rapl/*. Re-run safely.
#
# Usage:  sudo ./setup/install-rapl-access.sh [user-to-add]
# Default user-to-add is $SUDO_USER (the user that invoked sudo).

set -eu

if [ "$(id -u)" -ne 0 ]; then
    echo "Must be run as root (try: sudo $0)" >&2
    exit 1
fi

TARGET_USER="${1:-${SUDO_USER:-}}"
if [ -z "$TARGET_USER" ]; then
    echo "Could not determine which user to add to the powermon group." >&2
    echo "Usage: sudo $0 <username>" >&2
    exit 1
fi

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
RULE_SRC="$SCRIPT_DIR/60-intel-rapl.rules"
RULE_DST=/etc/udev/rules.d/60-intel-rapl.rules

if [ ! -f "$RULE_SRC" ]; then
    echo "Cannot find $RULE_SRC" >&2
    exit 1
fi

if ! getent group powermon >/dev/null; then
    echo "Creating 'powermon' group..."
    groupadd --system powermon
fi

if id -nG "$TARGET_USER" | tr ' ' '\n' | grep -qx powermon; then
    echo "User '$TARGET_USER' is already in the powermon group."
else
    echo "Adding '$TARGET_USER' to the powermon group..."
    usermod -aG powermon "$TARGET_USER"
fi

echo "Installing udev rule -> $RULE_DST"
install -m 0644 "$RULE_SRC" "$RULE_DST"

echo "Reloading udev..."
udevadm control --reload-rules
udevadm trigger --subsystem-match=powercap

echo
echo "Done. You must LOG OUT and LOG BACK IN for the group membership to apply."
echo "After that, /sys/class/powercap/intel-rapl/intel-rapl:0/energy_uj should be readable by '$TARGET_USER'."
