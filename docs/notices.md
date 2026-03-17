<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->
**Table of Contents**

- [build](#build)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

# build

```bash
# Beispiel: kompiliere zu ghupdate.js + ghupdate.wasm
emcc check_gh_update.cpp \
  -std=c++23 -O3 \
  -sEXPORTED_FUNCTIONS='["_compare_versions"]' \
  -sEXPORTED_RUNTIME_METHODS='["cwrap"]' \
  -sMODULARIZE=0 \
  -sALLOW_MEMORY_GROWTH=1 \
  -sFETCH=1 \
  -o ghupdate.js
```
