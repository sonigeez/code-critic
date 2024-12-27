# AI Code Review

A smol webhook handler which takes a github push event and write review to the pull in comment.

## How to use
1. Get your enviorment keys from your fav openai compatible provider.(i.e openai, gemini, openrouter).
2. Get Github Token with proper permission.
3. set envs in .env file and lambda function.
4. run `pnpm i && pnpm run build` to install dependencies and build the project.
5. run `pnpm run zip` to zip the project.
6. deploy the zip file to aws lambda.
7. add webhook to your github repo in settings tab with push event.

## TODO
- [ ] Add more github event (i.e pull request, push, etc).
