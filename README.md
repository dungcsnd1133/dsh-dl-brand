# dsh-dl-brand

Thương hiệu **DL** và bản dịch tiếng Việt cho giao diện web của DSH.

Plugin này gồm hai phần, cùng nằm trong một client bundle:

1. **Logo & thương hiệu** — thay dấu ở thanh bên bằng glyph Qwen trong gradient thương hiệu DL (không kèm chữ).
2. **Tiếng Việt** — thêm `vi` vào danh sách ngôn ngữ và cung cấp từ điển cho 45 namespace của giao diện.

## Cài đặt

Bundle này là một patch layer của profile, giống `dsh-tlpro-models`:

```bash
# 1. Khai báo dependency dạng link trong profile
#    $DSH_HOME/profiles/<tên-profile>/package.json
"dependencies": { "dsh-dl-brand": "link:/đường/dẫn/tới/dsh-dl-brand" }

# 2. Thêm vào danh sách bundle, THỨ TỰ QUAN TRỌNG
"dsh": { "profile": { "bundles": [ ..., "dsh-dl-brand" ] } }

# 3. Cài để DSH resolve được
cd "$DSH_HOME/profiles/<tên-profile>" && pnpm install
```

Thứ tự bundle quyết định thắng thua khi hai bundle cùng sửa một row. `dsh-dl-brand` phải đứng **sau** `@deepseek-ai/dsh-web-app` (nơi khai báo `ui-brand-official`), nếu không patch tắt row đó sẽ không áp dụng.

Sau khi thêm, DSH hot-reload và plugin hoạt động ngay, không cần restart.

## Cấu trúc

```
package.json          khai báo bundle patch + dsh.client (inject, platform)
cordis.patch.yml      insert row dl-brand, tắt ui-brand-official
lib/index.js          node half — rỗng, chỉ để Loader có thứ để mount
lib/client.js         SẢN PHẨM BUILD — không sửa tay
src/mark.js           glyph Qwen + component mark (wordmark rỗng)
src/locale.js         đăng ký ngôn ngữ vi và từ điển
src/apply.js          thân plugin: nối slot + locale
src/dicts/vi/*.json   từ điển tiếng Việt, mỗi namespace một file
reference/en/*.json   bản tiếng Anh gốc, dùng làm nguồn đối chiếu
build/build.mjs       ghép src/ thành lib/client.js
build/validate.mjs    đối chiếu từ điển với bản tiếng Anh
build/smoke.mjs       kiểm tra bundle đã build, không cần browser
```

### Vì sao phải có bước build

Mỗi client plugin của DSH là **đúng một** file bundle, và `require` bên trong nó chỉ resolve được các module host cấp (`dsh.client.external`). Không có `require` tương đối. Vì vậy `lib/client.js` không thể import file bên cạnh lúc chạy.

Nhiều người cùng làm thì mỗi người sở hữu file nguồn riêng trong `src/`, còn `build/build.mjs` là **thứ duy nhất** ghi `lib/client.js`. Đây là lý do tồn tại của thư mục `build/` — không phải để cho đẹp.

## Quy trình làm việc

```bash
# 1. Dịch / sửa: chỉ sửa file trong src/
# 2. Build lại bundle
node build/build.mjs

# 3. Kiểm tra từ điển (đối chiếu reference/en, placeholder, coverage)
node build/validate.mjs

# 4. Kiểm tra bundle (chạy được không, đăng ký đúng chỗ không)
node build/smoke.mjs
```

Chạy cả ba trước khi bật lên instance thật. `smoke.mjs` là chốt chặn cuối: nếu nó fail mà vẫn bật, thanh bên có thể hỏng cho mọi người dùng.

## Dịch thêm

Key thiếu **không** gây lỗi: `addLanguage` khai báo `en` làm fallback, nên key không có trong từ điển `vi` sẽ hiện tiếng Anh. Nhờ vậy có thể dịch dần từng namespace.

Thêm namespace mới:

1. Lấy bản tiếng Anh: chạy `node reference/extract.mjs`. Script tự dò bản DSH mới nhất đã cài; nếu máy có nhiều bản hoặc DSH nằm ở chỗ lạ, ép bằng biến môi trường:
   ```bash
   DSH_MODULES=<dsh-install>/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai \
     node reference/extract.mjs
   ```
   `reference/en/` **không nằm trong repo** (xem LICENSE): đó là bản sao nguyên văn chuỗi giao diện tiếng Anh của DSH, không phải của package này.
2. Tạo `src/dicts/vi/<namespace>.json` với key y hệt `reference/en/<namespace>.json`.
3. `node build/build.mjs && node build/validate.mjs && node build/smoke.mjs`.

Quy ước dịch đã dùng:

- Giữ nguyên tiếng Anh cho thuật ngữ kỹ thuật đã quen: `token`, `prompt`, `agent`, `plugin`, `skill`, `commit`, `workspace`, `sandbox`, `model`, `provider`.
- Dấu thanh kiểu hiện đại: `hoá`, `xoá`, `tuỳ`, `khoá` (không dùng `hóa/xóa/tùy/khóa`).
- Placeholder `{name}` giữ nguyên, không dịch, không đổi tên.
- Dấu ba chấm dùng `…` một ký tự như bản gốc.

## Thay đổi giao diện

Mark nằm ở `src/mark.js`. Component nhận `size` (cạnh vuông, pixel) và phải nằm gọn trong hộp đó vì thanh bên thu gọn rất hẹp. Không dùng file ảnh rời — bundle là một file đọc từ đĩa, đường dẫn asset sẽ 404. Mọi thứ phải inline (SVG hoặc CSS).

### Logo

Mark là **glyph Qwen chính thức**: ba khối bo tròn xếp thành tam giác xoay, khoảng trắng âm đọc ra chữ "Q". Ba path lấy nguyên văn từ `qwen-logo.svg` chính thức của qwen.ai (viewBox `0 0 20 20` cho riêng icon), không vẽ lại bằng mắt.

Màu: gradient **tím → chàm → lam** của thương hiệu DL. Bản gốc Qwen dùng một màu xanh dương `#082DFF`; gradient là ghi đè có chủ đích, hình khối mới là thứ mang nhận diện.

### Vì sao bỏ wordmark

Yêu cầu là bỏ chữ. Nhưng **không thể bỏ trống slot** `sidebar.brand.name`: nếu không đăng ký, fallback của sidebar là nhãn **"Local build"** nằm ngay cạnh logo. Vì vậy `DlBrandName` vẫn đăng ký nhưng render một `<span aria-hidden style="display:none">` — slot có chủ, không có chữ.

### Hai cái bẫy đã gặp, đừng lặp lại

1. **`id` của SVG là phạm vi document.** Thanh bên mount mark **hai lần cùng lúc** (rail thu gọn + hàng mở rộng). Đặt `id` gradient cố định thì hai instance dùng chung một định nghĩa, instance này mất màu khi instance kia unmount. `src/mark.js` dùng `react.useId()` cho mỗi instance; `build/smoke.mjs` có test riêng chặn tái phát.
2. **Bỏ trống slot ≠ bỏ đăng ký.** Xem mục wordmark ở trên.

### Vì sao glyph Qwen hợp với 24px

Thanh bên render mark ở **24px**. Hai chữ cái trong hộp 32 đơn vị co còn ~8px mỗi chữ và nhoè thành vệt; linh vật mềm mất mắt. Ba khối Qwen là hình dương đặc, ngăn cách bằng khoảng âm rộng, nên vẫn đọc được ở 24px và vẫn cân ở 40px.

## Cài đặt

Bundle này là một patch layer của profile, giống `dsh-tlpro-models`:

```bash
# 1. Khai báo dependency dạng link trong profile
#    $DSH_HOME/profiles/<tên-profile>/package.json
"dependencies": { "dsh-dl-brand": "link:/đường/dẫn/tới/dsh-dl-brand" }

# 2. Thêm vào danh sách bundle, THỨ TỰ QUAN TRỌNG
"dsh": { "profile": { "bundles": [ ..., "dsh-dl-brand" ] } }

# 3. Cài để DSH resolve được
cd "$DSH_HOME/profiles/<tên-profile>" && pnpm install
```

Thứ tự bundle quyết định thắng thua khi hai bundle cùng sửa một row. `dsh-dl-brand` phải đứng **sau** `@deepseek-ai/dsh-web-app` (nơi khai báo `ui-brand-official`), nếu không patch tắt row đó sẽ không áp dụng.

Sau khi thêm, DSH hot-reload và plugin hoạt động ngay, không cần restart.

## Cấu trúc

```
package.json          khai báo bundle patch + dsh.client (inject, platform)
cordis.patch.yml      insert row dl-brand, tắt ui-brand-official
lib/index.js          node half — rỗng, chỉ để Loader có thứ để mount
lib/client.js         SẢN PHẨM BUILD — không sửa tay
src/mark.js           glyph Qwen + component mark (wordmark rỗng)
src/locale.js         đăng ký ngôn ngữ vi và từ điển
src/apply.js          thân plugin: nối slot + locale
src/dicts/vi/*.json   từ điển tiếng Việt, mỗi namespace một file
reference/en/*.json   bản tiếng Anh gốc, dùng làm nguồn đối chiếu
build/build.mjs       ghép src/ thành lib/client.js
build/validate.mjs    đối chiếu từ điển với bản tiếng Anh
build/smoke.mjs       kiểm tra bundle đã build, không cần browser
```

### Vì sao phải có bước build

Mỗi client plugin của DSH là **đúng một** file bundle, và `require` bên trong nó chỉ resolve được các module host cấp (`dsh.client.external`). Không có `require` tương đối. Vì vậy `lib/client.js` không thể import file bên cạnh lúc chạy.

Nhiều người cùng làm thì mỗi người sở hữu file nguồn riêng trong `src/`, còn `build/build.mjs` là **thứ duy nhất** ghi `lib/client.js`. Đây là lý do tồn tại của thư mục `build/` — không phải để cho đẹp.

## Quy trình làm việc

```bash
# 1. Dịch / sửa: chỉ sửa file trong src/
# 2. Build lại bundle
node build/build.mjs

# 3. Kiểm tra từ điển (đối chiếu reference/en, placeholder, coverage)
node build/validate.mjs

# 4. Kiểm tra bundle (chạy được không, đăng ký đúng chỗ không)
node build/smoke.mjs
```

Chạy cả ba trước khi bật lên instance thật. `smoke.mjs` là chốt chặn cuối: nếu nó fail mà vẫn bật, thanh bên có thể hỏng cho mọi người dùng.

## Dịch thêm

Key thiếu **không** gây lỗi: `addLanguage` khai báo `en` làm fallback, nên key không có trong từ điển `vi` sẽ hiện tiếng Anh. Nhờ vậy có thể dịch dần từng namespace.

Thêm namespace mới:

1. Lấy bản tiếng Anh: chạy `node reference/extract.mjs` để trích lại toàn bộ (script đọc thẳng từ gói cài đặt của DSH).
2. Tạo `src/dicts/vi/<namespace>.json` với key y hệt `reference/en/<namespace>.json`.
3. `node build/build.mjs && node build/validate.mjs && node build/smoke.mjs`.

Quy ước dịch đã dùng:

- Giữ nguyên tiếng Anh cho thuật ngữ kỹ thuật đã quen: `token`, `prompt`, `agent`, `plugin`, `skill`, `commit`, `workspace`, `sandbox`, `model`, `provider`.
- Dấu thanh kiểu hiện đại: `hoá`, `xoá`, `tuỳ`, `khoá` (không dùng `hóa/xóa/tùy/khóa`).
- Placeholder `{name}` giữ nguyên, không dịch, không đổi tên.
- Dấu ba chấm dùng `…` một ký tự như bản gốc.

## Thay đổi giao diện

Mark nằm ở `src/mark.js`. Component nhận `size` (cạnh vuông, pixel) và phải nằm gọn trong hộp đó vì thanh bên thu gọn rất hẹp. Không dùng file ảnh rời — bundle là một file đọc từ đĩa, đường dẫn asset sẽ 404. Mọi thứ phải inline (SVG hoặc CSS).

### Vì sao là linh vật chứ không phải chữ "DL"

Thanh bên render mark ở **24px**. Trong hộp 32 đơn vị, hai chữ cái co lại còn khoảng 8px mỗi chữ và nhoè thành vệt — đã thử và loại. Một khối silhouette với hai mắt vẫn đọc được ở 24px và vẫn đẹp ở 40px, nên mark là linh vật: thân tròn gradient tím → chàm → lam (bảng màu họ Qwen), một vệt sáng lệch trên, và một sợi ăng-ten xoáy.

### Hai cái bẫy đã gặp, đừng lặp lại

1. **`id` của SVG là phạm vi document.** Thanh bên mount mark **hai lần cùng lúc** (rail thu gọn + hàng mở rộng). Đặt `id` gradient cố định thì hai instance dùng chung một định nghĩa, instance này mất màu khi instance kia unmount. `src/mark.js` dùng `react.useId()` cho mỗi instance; `build/smoke.mjs` có test riêng chặn tái phát.
2. **Màu chữ phải theo theme.** Logo dùng màu thương hiệu cố định (đúng — logo không đổi màu theo theme), nhưng chữ "DL" cạnh nó dùng `var(--dsw-alias-label-primary)` để không thành đen trên nền đen.

## Gỡ bỏ

Xoá `dsh-dl-brand` khỏi `dsh.profile.bundles` là đủ: patch tắt `ui-brand-official` biến mất theo, logo chính thức quay lại, và ngôn ngữ `vi` không còn trong danh sách. Không có file nào của DSH bị sửa.

```bash
cd "$DSH_HOME/profiles/<tên-profile>" && pnpm remove dsh-dl-brand
```

Nhớ xoá cả dòng trong `dependencies` và `bundles` của `package.json`.
