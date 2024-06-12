
#!/bin/bash
echo Patient Log: Executing postbuild.sh

echo Patient Log: Removing ./amplify-hosting
rm -rf ./.amplify-hosting

echo Patient Log: Recreating ./.amplify-hosting
mkdir -p ./.amplify-hosting/compute

echo Patient Log: Migrating to ./.amplify-hosting
cp -r ./dist ./.amplify-hosting/compute/default
cp -r ./node_modules ./.amplify-hosting/compute/default/node_modules

cp -r public ./.amplify-hosting/static

echo Patient Log: migrating deploy-manifest.json
cp deploy-manifest.json ./.amplify-hosting/deploy-manifest.json
