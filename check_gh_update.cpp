/**
 * SPDX-FileComment: GitHub Update Checker WASM Worker
 * SPDX-FileType: SOURCE
 * SPDX-FileContributor: ZHENG Robert
 * SPDX-FileCopyrightText: 2026 ZHENG Robert
 * SPDX-License-Identifier: MIT
 *
 * @file check_gh_update.cpp
 * @brief WASM build with Emscripten for a GitHub Update Checker. browser‑based
 * tool that checks GitHub repositories for the latest release and compares it
 * with local versions supplied in a CSV file.
 * @version 0.1.0
 * @date 2026-03.17
 *
 * @author ZHENG Robert (robert@hase-zheng.net)
 * @copyright Copyright (c) 2026 ZHENG Robert
 *
 * @license MIT License
 */

#include <cstdlib>
#include <cstring>
#include <emscripten/emscripten.h>
#include <regex>
#include <stdexcept>
#include <string>
#include <string_view>

struct SemVer {
  int major = 0, minor = 0, patch = 0;
  static SemVer parse(std::string_view v) {
    std::regex re(R"(v?(\d+)\.(\d+)(?:\.(\d+))?)");
    std::cmatch m;
    std::string s(v);
    if (!std::regex_search(s.c_str(), m, re))
      throw std::runtime_error("Invalid SemVer: " + s);
    SemVer sv;
    sv.major = std::stoi(m[1]);
    sv.minor = std::stoi(m[2]);
    sv.patch = m[3].matched ? std::stoi(m[3]) : 0;
    return sv;
  }
};

// Compare two version strings a and b.
// Return -1 if a < b, 0 if equal, 1 if a > b
extern "C" {
EMSCRIPTEN_KEEPALIVE
int compare_versions(const char *a, const char *b) {
  try {
    SemVer va = SemVer::parse(a ? a : "");
    SemVer vb = SemVer::parse(b ? b : "");
    if (va.major < vb.major)
      return -1;
    if (va.major > vb.major)
      return 1;
    if (va.minor < vb.minor)
      return -1;
    if (va.minor > vb.minor)
      return 1;
    if (va.patch < vb.patch)
      return -1;
    if (va.patch > vb.patch)
      return 1;
    return 0;
  } catch (...) {
    // On parse error, treat as incomparable: return 0 and let caller handle
    return 0;
  }
}
}
