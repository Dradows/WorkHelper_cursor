# 工具箱(Vite + React)

一个使用现代前端技术栈构建的实时二维码生成器，基于Vite和React实现。

## 🚀 技术栈

- **Vite** - 快速的前端构建工具
- **React 18** - 现代化的UI库
- **QRCode.js** - 高性能二维码生成库
- **CSS3** - 现代化样式和动画

## ✨ 功能特点

- 🚀 **实时生成**: 输入内容后自动生成二维码，无需手动点击
- 📱 **响应式设计**: 支持各种设备尺寸，移动端友好
- 🎨 **现代化UI**: 美观的渐变背景和卡片式设计
- ⚡ **防抖优化**: 避免频繁生成，提升性能
- 📏 **尺寸可调**: 支持多种二维码尺寸选择
- 💾 **一键下载**: 生成的二维码可直接下载为PNG图片
- 🔧 **模块化架构**: 清晰的组件结构和工具函数分离

## 🛠️ 开发环境

### 系统要求

- Node.js 16.0 或更高版本
- npm 或 yarn 包管理器

### 安装依赖

```bash
npm install
```

### 启动开发服务器

```bash
npm run dev
```

### 构建生产版本

```bash
npm run build
```

### 预览生产版本

```bash
npm run preview
```

## 📁 项目结构

```
workHelper/
├── src/
│   ├── components/
│   │   ├── QRCodeGenerator.jsx    # 主要组件
│   │   └── QRCodeGenerator.css    # 组件样式
│   ├── utils/
│   │   └── qrCodeUtils.js         # 二维码生成工具
│   ├── App.jsx                     # 应用主组件
│   ├── App.css                     # 应用样式
│   ├── main.jsx                    # 应用入口
│   └── index.css                   # 全局样式
├── index.html                      # HTML模板
├── package.json                    # 项目配置
├── vite.config.js                  # Vite配置
├── .eslintrc.cjs                   # ESLint配置
└── README.md                       # 项目说明
```

## 🎯 核心组件

### QRCodeGenerator

主要的二维码生成组件，包含：

- 文本输入处理
- 防抖优化
- 加载状态管理
- 错误处理
- 下载功能

### qrCodeUtils

二维码生成工具函数，支持：

- PNG格式 (Data URL)
- Canvas元素
- SVG字符串

## 🔧 自定义配置

### 二维码选项

可以在 `src/utils/qrCodeUtils.js` 中修改：

- 尺寸大小
- 边距设置
- 颜色配置
- 错误纠正级别

### 样式定制

所有样式都在对应的CSS文件中，支持：

- 主题色彩
- 布局调整
- 响应式断点
- 动画效果

## 🌐 浏览器兼容性

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## 📱 响应式特性

- 移动端优化的触摸体验
- 自适应布局
- 灵活的控件排列
- 优化的字体大小

## 🚀 性能优化

- 防抖处理避免频繁操作
- 异步二维码生成
- 组件懒加载支持
- 优化的重渲染策略

## 🔍 开发工具

- ESLint 代码质量检查
- Vite 热模块替换 (HMR)
- React DevTools 支持
- 源码映射调试

## 📄 许可证

MIT License - 可自由使用和修改

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📞 支持

如有问题或建议，请通过以下方式联系：

- 提交 GitHub Issue
- 发送邮件至项目维护者
