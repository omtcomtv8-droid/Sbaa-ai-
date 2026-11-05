#!/usr/bin/env bash
set -e

KEYSTORE_NAME="android/app/release-key.jks"
ALIAS="sabaa"
PASSWORD="sabaa12345"

echo "Generating Android Release Keystore at $KEYSTORE_NAME..."
keytool -genkeypair -v \
  -keystore "$KEYSTORE_NAME" \
  -alias "$ALIAS" \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -storepass "$PASSWORD" \
  -keypass "$PASSWORD" \
  -dname "CN=Sabaa AI, OU=Engineering, O=Sabaa AI Solution, L=Dubai, ST=Dubai, C=AE"

echo "Keystore successfully created at $KEYSTORE_NAME"
echo "Alias: $ALIAS"
echo "Password: $PASSWORD"
