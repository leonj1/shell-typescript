#!/bin/bash

echo "Building @shell/interfaces..."
cd packages/interfaces
npx tsc
cd ../..

echo "Building @shell/core..."
cd packages/shell
npx tsc
cd ../..

echo "Building @shell/cli..."
cd packages/cli
npx tsc
cd ../..

echo "Build complete!"