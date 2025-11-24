#!/bin/bash

# Test script for uu-secret-manager
# This script tests the basic functionality of the tool

set -e

echo "=== uu-secret-manager Test Suite ==="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Test directory
TEST_DIR="./test"
SECRETS_FILE="./test-secrets.json"

# Cleanup function
cleanup() {
    echo "Cleaning up..."
    if [ -f "$SECRETS_FILE" ]; then
        rm -f "$SECRETS_FILE"
    fi
    # Restore original test files
    git checkout -- "$TEST_DIR" 2>/dev/null || true
}

trap cleanup EXIT

echo "Step 1: Add secrets to the store"
echo "--------------------------------"
echo "testpassword" | npx . add "super_secret_password_123" -s "$SECRETS_FILE"
echo "testpassword" | npx . add "sk-1234567890abcdefghijklmnop" -s "$SECRETS_FILE"
echo "testpassword" | npx . add "my_api_secret_key_xyz" -s "$SECRETS_FILE"
echo "testpassword" | npx . add "jwt_token_secret_12345" -s "$SECRETS_FILE"
echo "testpassword" | npx . add "sk_test_stripe_key_abc123" -s "$SECRETS_FILE"
echo -e "${GREEN}✓ Secrets added${NC}"
echo ""

echo "Step 2: List secrets"
echo "--------------------"
echo "testpassword" | npx . list -s "$SECRETS_FILE"
echo -e "${GREEN}✓ Secrets listed${NC}"
echo ""

echo "Step 3: Replace secrets in test files"
echo "--------------------------------------"
# Make a backup of test files
cp -r "$TEST_DIR" "${TEST_DIR}.backup"
echo "testpassword" | npx . replace "$TEST_DIR" -s "$SECRETS_FILE"
echo -e "${GREEN}✓ Secrets replaced with placeholders${NC}"
echo ""

echo "Step 4: Verify placeholders exist"
echo "----------------------------------"
if grep -r "<!secret_" "$TEST_DIR" > /dev/null; then
    echo -e "${GREEN}✓ Placeholders found in test files${NC}"
else
    echo -e "${RED}✗ No placeholders found - test failed${NC}"
    exit 1
fi
echo ""

echo "Step 5: Verify original secrets are gone"
echo "-----------------------------------------"
if grep -r "super_secret_password_123" "$TEST_DIR" > /dev/null; then
    echo -e "${RED}✗ Original secrets still found - replacement failed${NC}"
    exit 1
else
    echo -e "${GREEN}✓ Original secrets replaced${NC}"
fi
echo ""

echo "Step 6: Reverse placeholders back to secrets"
echo "---------------------------------------------"
echo "testpassword" | npx . reverse "$TEST_DIR" -s "$SECRETS_FILE"
echo -e "${GREEN}✓ Placeholders reversed${NC}"
echo ""

echo "Step 7: Verify secrets are restored"
echo "------------------------------------"
if grep -r "super_secret_password_123" "$TEST_DIR" > /dev/null; then
    echo -e "${GREEN}✓ Secrets restored successfully${NC}"
else
    echo -e "${RED}✗ Secrets not restored - test failed${NC}"
    exit 1
fi
echo ""

echo "Step 8: Compare with backup"
echo "---------------------------"
if diff -r "$TEST_DIR" "${TEST_DIR}.backup" > /dev/null; then
    echo -e "${GREEN}✓ Files match original - full cycle successful${NC}"
else
    echo -e "${RED}✗ Files differ from original${NC}"
    exit 1
fi
echo ""

# Cleanup backup
rm -rf "${TEST_DIR}.backup"

echo "==================================="
echo -e "${GREEN}All tests passed! ✓${NC}"
echo "==================================="
