# TIDE — 王瑞琪的个人空间

一个从日落海面开始、随滚动潜入深海的个人网站首页，展示王瑞琪的 AI 产品设计背景、项目与经历。

## 本地预览

```sh
npm run dev
```

打开 http://127.0.0.1:4173 。网站没有安装依赖或构建步骤，请通过 HTTP 打开，不要直接双击 HTML（浏览器会限制 ES 模块的本地文件加载）。

## 已实现

- 全屏实时 WebGL 大浪、多尺度水面法线、明亮天空与落日反光。
- 360svh 的缓慢下潜行程；主动下潜按钮使用可随时打断的 3.4 秒镜头移动。
- 水下恢复参考图版本的写实底图、轻微折射、柔和透光及稀疏 1–3px 上浮微气泡。
- 简洁个人介绍、两项真实项目简介、可展开的实习与教育经历、邮箱及 GitHub 联系方式。
- 点击开启的本地合成海浪环境音；播放/暂停动效。
- 响应式布局、键盘导航、减少动态效果偏好、无 WebGL 时的静态降级。
- 图片和法线贴图随网站一起保存；运行不依赖远程图片、视频、字体或 JS 库。

## 个性化

- `dist/index.html`：介绍、项目名称、经历、首页文案。
- `dist/app.js`：项目详情 `projects`，交互逻辑。
- `dist/profile.js`：姓名、邮箱、职业方向、GitHub。联络按钮使用 `mailto:` 打开访客的邮件应用，本站不收集或代发消息。
- `dist/style.css`：字体、颜色、间距、移动端布局。
- `dist/ocean.js`：海面/天空/水下着色器；`SUN`、相机高度与倾角可调整太阳、海浪与地平线。

保留 TIDE 作为视觉品牌，姓名、教育、实习和项目内容来自用户提供的简历。项目封面为标注“项目简介”的抽象视觉，并非产品界面截图。仅展示邮箱与 GitHub，不附完整简历或手机号。修改介绍和职业方向时请同步 HTML 与 `profile.js`。

## 与参考的关系

按用户提供的视频和水下截图观察构图：左侧衬线标题、浅蓝天空、右侧日落、低视角海浪以及滚动潜入水下。采用实时海面与生成的天空/水下图片相结合；水下图片持续受折射和镜头变化影响。它重现交互方向与氛围，并非视频中原始素材的逐像素复制。

调研过的公开技术参考：

- https://github.com/squall01337/abyssal-ocean — FFT 海浪和水下光学，MIT。
- https://github.com/nimeshm05/sunset-shader — 实时日落、云与海浪，MIT。
- https://github.com/achrefelouafi/WaterThreeJS — 海面/水下和体积光，MIT。
- https://github.com/Noniv/web-ocean — WebGPU 海面、云与落日，MIT。

海浪的波形与解析梯度方法参考 sunset-shader，许可保留在 `dist/vendor-LICENSE.txt`。水面法线来自 Three.js 官方 `examples/textures/waternormals.jpg`，完整归属、MIT 许可和原始来源记录保留在 `dist/THIRD_PARTY_LICENSES.txt`。

图片使用内置 imagegen 工具生成或编辑，素材位于 `dist/assets/`；最终提示词和来源见 [SKY_ASSET.md](SKY_ASSET.md)。实际加载 `sunset-sky-light.png` 和 `underwater-reference-v2.png`。后者根据用户提供的截图去除 UI 与黑边，保留原水下构图和光色，再叠加细微实时折射。旧版素材保留作比较。

## 检查与限制

海面原有版本已检查 JS 语法、资源 HTTP 路径、导航目标，并使用独立本地 Chrome 完成桌面/手机截图、WebGL 编译、动画/暂停、项目弹窗及减少动态效果偏好检查。自动测试使用软件图形后端，不能代表实际设备的硬件帧率；渲染器会自动降低分辨率以缓解持续低帧率。

正式对外发布前，可在目标手机/电脑上确认海面效果。Sites 部署保留原访问范围。
