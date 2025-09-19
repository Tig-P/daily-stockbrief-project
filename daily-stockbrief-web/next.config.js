const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  trailingSlash: true,
  outputFileTracingRoot: path.join(__dirname), // ← 루트를 명시적으로 지정
};

module.exports = nextConfig;
