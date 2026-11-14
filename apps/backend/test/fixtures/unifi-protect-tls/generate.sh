#!/bin/sh
# Regenerates the TLS material used by the UniFi Protect plugin tests.
#
# TEST MATERIAL ONLY: the private keys committed next to this script have no value outside the test suite.
# They protect nothing, must never be reused for a real service and must never be loaded outside tests.
#
#   ca.crt           test CA ("Smart Panel Test CA"); its key is deleted at the end of the run
#   console.crt/key  leaf for fakeconsole.id.ui.direct signed by the test CA
#   self-signed.crt/key  self-signed certificate for unifi.local
#
# Requires OpenSSL 1.1.1 or newer.
set -eu

DIR=$(cd "$(dirname "$0")" && pwd)
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

DAYS=36500
DOMAIN=fakeconsole.id.ui.direct

cd "$WORK"

# Test CA
openssl ecparam -name prime256v1 -genkey -noout -out ca.key
openssl req -new -x509 -key ca.key -sha256 -days "$DAYS" -subj "/CN=Smart Panel Test CA" \
	-addext "basicConstraints=critical,CA:TRUE" -addext "keyUsage=critical,keyCertSign,cRLSign" -out ca.crt

# Console leaf signed by the CA
openssl ecparam -name prime256v1 -genkey -noout -out console.key
openssl req -new -key console.key -subj "/CN=$DOMAIN" -out console.csr
cat > console.ext <<EXT
basicConstraints=CA:FALSE
keyUsage=critical,digitalSignature
extendedKeyUsage=serverAuth
subjectAltName=DNS:$DOMAIN
EXT
openssl x509 -req -in console.csr -CA ca.crt -CAkey ca.key -CAcreateserial -sha256 -days "$DAYS" \
	-extfile console.ext -out console.crt

# Self-signed certificate, like an unconfigured console presents when reached by IP
openssl ecparam -name prime256v1 -genkey -noout -out self-signed.key
openssl req -new -x509 -key self-signed.key -sha256 -days "$DAYS" -subj "/CN=unifi.local" \
	-addext "subjectAltName=DNS:unifi.local" -out self-signed.crt

openssl verify -CAfile ca.crt console.crt

# ca.key and the CSR are not published
cp ca.crt console.crt console.key self-signed.crt self-signed.key "$DIR/"
