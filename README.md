# parts-product-selection

面向 Amazon 新卖家的机械产品选品 Skill。支持从 ASIN、产品图片、型号/OEM号、Amazon 搜索或类目链接、供应商页面和批量候选开始，分析市场需求、新卖家进入机会、SellerSprite 关键词、CPC、评论、性能、适配、合规、履约、利润及回本时间。

## 支持的产品

- 替换件与耗材；
- 机械总成；
- 工程机械附件与属具；
- 液压与气动产品；
- 汽油与柴油动力整机；
- 电动与电池机械；
- 手动与无动力机械；
- 安全、承载与关键失效产品。

模型不会用头部卖家的成功代替新卖家进入证据。头部独立父 ASIN 只验证需求；中尾部、新品和低评论卖家的持续出单用于判断进入机会。

## 下载

- [下载最新 Release](https://github.com/zhanggoudan/parts-product-selection/releases/latest)
- [下载 main 分支 ZIP](https://github.com/zhanggoudan/parts-product-selection/archive/refs/heads/main.zip)

## 安装到 Codex

使用 Git 安装：

```bash
git clone https://github.com/zhanggoudan/parts-product-selection.git ~/.codex/skills/parts-product-selection
```

已经安装时更新：

```bash
git -C ~/.codex/skills/parts-product-selection pull --ff-only
```

也可以下载 ZIP，将解压后的目录重命名为 `parts-product-selection`，放入：

```text
~/.codex/skills/parts-product-selection
```

重新启动 Codex 或开启新会话，使 Skill 目录重新被发现。

## 基本使用

分析单个 ASIN：

```text
用 $parts-product-selection 分析 ASIN:B0XXXXXXXX。
站点使用 Amazon US，判断它是否适合新卖家上架。
```

分析图片或型号：

```text
用 $parts-product-selection 分析这张产品图片和型号 HH150-32430。
先确认产品身份、适配和关键规格，再给预评分。
```

分析整机：

```text
用 $parts-product-selection 分析这款 6.5HP/196cc 汽油平板夯。
加入 EPA/CARB、FBA/FBM、保修、备件、退货和广告后利润。
```

分析类目或批量候选：

```text
用 $parts-product-selection 分析这个 Amazon 类目链接。
先按产品族、动力源、性能档和履约方式拆分市场；
输出前10名候选，再深挖前3名，最后只选一个适合新卖家测试的产品。
```

分析成本和回本时间：

```text
用 $parts-product-selection 分析：
ASIN：B0XXXXXXXX
采购成本：
包装尺寸与重量：
采购数量：
运输方式：
目标售价：
广告预算：
可接受最大亏损：
请计算广告后贡献利润、单月转正和累计回本。
```

## SellerSprite

SellerSprite API 是可选项。使用者必须提供自己的授权和账户，仓库不包含任何密钥。

将密钥保存在环境变量中：

```bash
export SELLERSPRITE_SECRET_KEY='your-own-secret'
```

不要把密钥写入 Skill、命令参数、截图、日志、Git 或聊天。API 不可用时，Skill 会切换到用户已登录的 SellerSprite 网页端；网页也不可用时再降级到 Amazon 和其他公开来源，并降低证据等级。

## 决策标准

正式主推必须同时满足：

- 总分至少 70/100；
- 新卖家进入层至少 52/75；
- 可评分数据覆盖率至少 70%；
- 产品身份、性能、成本、适配、合规、履约和退货硬门槛全部通过。

数据不足时输出 `N/A` 和缺失项，不把未知数据当成零，也不凭经验补分。

## 验证

计算脚本只依赖 Python 标准库。运行仓库测试需要 PyYAML：

```bash
python3 -m pip install -r requirements-dev.txt
python3 -m unittest discover -s tests -v
```

## 安全与合规

本 Skill 提供研究流程，不替代认证机构、海关、保险、测试实验室或法律意见。汽油/柴油排放、电气和电池、高压液压、起重承载、制动、转向及其他安全关键产品，在缺少适用认证、测试和产品责任方案时不得主推。

## License

[MIT License](LICENSE)。可以使用、修改和再分发，但须保留版权及许可证声明。
