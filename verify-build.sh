#!/bin/bash

echo "Verifying build for all packages..."

# Verify @shell/interfaces
echo "Building @shell/interfaces..."
cd packages/interfaces
npx tsc --noEmit
if [ $? -eq 0 ]; then
  echo "@shell/interfaces builds successfully"
else
  echo "@shell/interfaces build failed"
  exit 1
fi
cd ../..

# Verify @shell/core
echo "Building @shell/core..."
cd packages/shell
npx tsc --noEmit
if [ $? -eq 0 ]; then
  echo "@shell/core builds successfully"
else
  echo "@shell/core build failed"
  exit 1
fi
cd ../..

# Verify @shell/cli
echo "Building @shell/cli..."
cd packages/cli
npx tsc --noEmit
if [ $? -eq 0 ]; then
  echo "@shell/cli builds successfully"
else
  echo "@shell/cli build failed"
  exit 1
fi
cd ../..

echo "All packages build successfully!"