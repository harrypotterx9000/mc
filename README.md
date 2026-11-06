# OpusMC

Browser voxel game (WebGL2, no engine). This repository is the standalone project copy of the
original OpusMC build `47455601425408-v39426`, prepared for de-Bilibili work.

## Run locally

```powershell
node scripts/serve.mjs
# open http://127.0.0.1:8080/ in Edge
```

No dependencies. The server binds `127.0.0.1` only.

## Layout

```
index.html        game page
js/               game sources (original files, original names)
scripts/serve.mjs local static server
docs/             project documentation (added after the initialization phase)
server/           self-hosted multiplayer server (later phase)
```

## Status

Initialization phase. No gameplay changes have been made; only the Bilibili page redirect was
removed so the page can run outside the Toy iframe. The untouched original is preserved in the
`v0.0.0-original` tag and in the workspace backup.
