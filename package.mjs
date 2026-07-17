// 打包 BiClock 为用于扩展商店发布的 zip。
// 用法： node package.mjs
//
// 仅包含浏览器加载扩展所需的运行时文件（manifest + 内容脚本 + popup + 图标），
// 排除 README、LICENSE、AGENTS.md、shot.mjs、node_modules 等开发产物。
// 输出文件位于项目根目录，文件名取自 manifest.json 的 version，例如 BiClock-3.0.zip。
// 生成时文件直接置于 zip 根目录（不嵌套顶层文件夹），符合扩展商店要求。

import { spawnSync } from 'node:child_process';
import {
    cpSync,
    existsSync,
    mkdirSync,
    readFileSync,
    rmSync,
    statSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));

// 需要打包进 zip 的运行时文件（仅扩展加载时需要的文件）。
const INCLUDE = [
    'manifest.json',
    'shared.js',
    'biclock.js',
    'popup.html',
    'popup.css',
    'popup.js',
    'icons/clock.png',
];

// 从 manifest.json 读取版本号作为 zip 文件名。
const manifest = JSON.parse(readFileSync(join(ROOT, 'manifest.json'), 'utf8'));
const version = manifest.version;
const zipName = `BiClock-${version}.zip`;
const zipPath = join(ROOT, zipName);

// 暂存目录：先把运行时文件复制进来，再 cd 进去打包，
// 这样 zip 内的文件直接位于根目录，且不会混入任何开发文件。
const staging = join(ROOT, '.dist-staging');
rmSync(staging, { recursive: true, force: true });
rmSync(zipPath, { force: true });
mkdirSync(staging, { recursive: true });

for (const rel of INCLUDE) {
    const src = join(ROOT, rel);
    if (!existsSync(src)) {
        console.error(`✗ 缺少文件： ${rel}`);
        rmSync(staging, { recursive: true, force: true });
        process.exit(1);
    }
    cpSync(src, join(staging, rel), { recursive: true });
}

// 跨平台生成 zip：优先用系统 zip（Linux / macOS / Git Bash for Windows 自带），
// 回退到 tar（Windows 自带的 libarchive/bsdtar）。
// 两者生成的都是规范 zip（正斜杠路径分隔符），被所有扩展商店正常识别。
// 探测通过 spawnSync(tool, ['--version']) 看是否可调用，取第一个可用的。
function pickZipTool() {
    const candidates = [
        // zip：在暂存目录执行 zip -r <out> . ，内容直接落在归档根目录。
        { tool: 'zip', args: (out) => ['-r', out, '.'] },
        // bsdtar（Windows tar.exe / macOS tar）：-a 按输出扩展名选 zip 格式。
        // --force-local 避免 Windows 盘符（如 D:）被当作 rsh 风格的远程主机。
        { tool: 'tar', args: (out) => ['--force-local', '-a', '-cf', out, '.'] },
    ];
    for (const c of candidates) {
        const probe = spawnSync(c.tool, ['--version'], { stdio: 'ignore' });
        // 命令存在即视为可用（ENOENT 时 probe.error 非空，直接跳过）。
        if (!probe.error) return c;
    }
    return null;
}

const tool = pickZipTool();
if (!tool) {
    console.error('✗ 未找到可用的 zip 工具：请安装 zip（或确认系统自带 tar）。');
    rmSync(staging, { recursive: true, force: true });
    process.exit(1);
}

const result = spawnSync(
    tool.tool,
    tool.args(zipPath),
    { cwd: staging, stdio: 'inherit' }
);

// 清理暂存目录。
rmSync(staging, { recursive: true, force: true });

if (result.status !== 0) {
    console.error('✗ 打包失败');
    process.exit(result.status ?? 1);
}

const sizeKB = (statSync(zipPath).size / 1024).toFixed(1);
console.log(`✓ 已生成 ${zipName}（${sizeKB} KB）`);
console.log(`  路径： ${zipPath}`);
console.log(`  包含： ${INCLUDE.join(', ')}`);
