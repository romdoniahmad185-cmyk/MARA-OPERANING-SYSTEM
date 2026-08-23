# MARA OS Engine

Folder ini berisi engine dasar untuk sistem update MARA OS.

## Engine

- repository-engine.js
- version-engine.js
- update-engine.js
- download-engine.js
- verify-engine.js
- install-engine.js
- backup-engine.js
- rollback-engine.js
- app-manager.js
- app-update-engine.js

## Urutan pemuatan

1. repository-engine.js
2. version-engine.js
3. update-engine.js
4. download-engine.js
5. verify-engine.js
6. install-engine.js
7. backup-engine.js
8. rollback-engine.js
9. app-manager.js
10. app-update-engine.js

## Catatan

Versi awal ini difokuskan pada arsitektur dan pengecekan update.
Browser/GitHub Pages tidak memberikan akses filesystem langsung untuk
mengganti file OS yang sudah ter-deploy. Mekanisme install/patch nyata
perlu disesuaikan dengan metode deployment MARA OS.
