
#!/bin/bash
echo ----- PATIENT POST-BUILD LOGS BEGIN -----

echo Evironment Check

if [ -z "$AWS_APP_ID" ];
then
    echo Local build execution, exiting
else
    echo $AWS_APP_ID
    echo AWS Build execution
fi

echo Patient Log: Removing ./amplify-hosting
if ! rm -rf ./.amplify-hosting;
then
    echo unable to remove ./.amplify-hosting
fi

echo Patient Log: Recreating ./.amplify-hosting
if ! mkdir -p ./.amplify-hosting/compute;
then
    echo unable to create .amplify-hosting
fi

echo Patient Log: Migrating to ./.amplify-hosting
echo Patient Log: Default files

if ! cp ./dist ./.amplify-hosting/compute/default;
then
    echo Failed to move ./dist
    exit 1
fi

echo Patient Log: Static files
if ! cp public ./.amplify-hosting/static;
then
    echo Failed to move Static Files.
    exit 1
fi

echo Patient Log: deploy-manifest.json

if ! cp deploy-manifest.json ./.amplify-hosting/deploy-manifest.json;
then
    echo Failed to move deploy-manifest.json
    exit 1
fi

echo ----- PATIENT POST-BUILD LOGS END -----