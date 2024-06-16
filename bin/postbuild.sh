
#!/bin/bash
echo ----- PATIENT POST-BUILD LOGS BEGIN -----

echo Evironment Check
echo $AWS_APP_ID

if [$AWS_APP_ID -eq ""];
then
    echo Local build execution, exiting
    exit 0
else
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

if ! mv -r ./dist ./.amplify-hosting/compute/default;
then
    echo Failed to copy ./dist
fi

echo Patient Log: Node Modules
if ! mv -r ./node_modules ./.amplify-hosting/compute/default/node_modules;
then
    echo Failed to copy ./node_modules
fi

echo Patient Log: Static files
if ! mv -r public ./.amplify-hosting/static;
then
    echo Failed to copy Static Files.
fi

echo Patient Log: deploy-manifest.json

if ! mv deploy-manifest.json ./.amplify-hosting/deploy-manifest.json;
then
    echo Failed to copy deploy-manifest.json
fi

echo ----- PATIENT POST-BUILD LOGS END -----