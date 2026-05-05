仅用于个人小群使用

# 一站式工具 

KanColle Hub —— 基于 Next.js 的协同工具。

## 功能

- **锁船规划**：海图锁船标签管理，支持拖拽分配舰娘、跨条移动
- **选船面板**：按等级/舰种/名称筛选舰娘，一键分配到锁船标签
- **全览视图**：所有提督的锁船分配
- **数据中心**：上传个人港口数据
  
## 技术栈

| 层 | 技术 |
|---|---|
| 框架 | Next.js 14 (App Router) |
| 语言 | TypeScript |
| 数据库 | SQLite + Prisma ORM |
| 样式 | Tailwind CSS |
| 认证 | bcryptjs + jose (JWT) |

## 本地开发

```bash
# 安装依赖
npm install

# 初始化数据库
npx prisma migrate dev

# 启动开发服务器
npm run dev
