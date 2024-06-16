
#!/bin/bash
echo ----- PATIENT POST-BUILD LOGS BEGIN -----

echo Evironment Check
echo $AWS_APP_ID

if [ -z "$AWS_APP_ID" ];
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

if ! mv ./dist ./.amplify-hosting/compute/default;
then
    echo Failed to move ./dist
    exit 1
fi

# echo Patient Log: Node Modules
# if ! mv ./node_modules ./.amplify-hosting/compute/default/node_modules;
# then
#     echo Failed to move ./node_modules
#     exit 1
# fi

echo Patient Log: Static files
if ! mv public ./.amplify-hosting/static;
then
    echo Failed to move Static Files.
    exit 1
fi

echo Patient Log: deploy-manifest.json

if ! mv deploy-manifest.json ./.amplify-hosting/deploy-manifest.json;
then
    echo Failed to move deploy-manifest.json
    exit 1
fi

if ! npm run start
then
    echo Failed to start react server
    exit 1
fi

echo ----- PATIENT POST-BUILD LOGS END -----