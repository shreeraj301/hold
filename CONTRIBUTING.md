# Contributing

Thanks for taking a look at Hold. Bug fixes, balance notes, and small play improvements are welcome.

## Setup

```bash
npm install && npm start
```

The field opens at http://localhost:8080.

## Before you open a pull request

```bash
npm run lint
npm run typecheck
npm run build
```

`npm test` is there too. A few script tests read a local `.grok` directory that is not part of this repository, so a clean checkout will not pass every one of them.

## Pull requests

Keep the change focused. Say what you played, and what you changed. Leave the look of the field alone unless the change is about that.

## Issues

Use the bug, feature, or question template. A question about how a wave works is as welcome as a bug.
