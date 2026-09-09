# Image Shortcut Paster

Chrome extension: lưu nhiều bộ phím mã gõ ↔ ảnh hoặc văn bản rồi chèn vào editor.

## Cài đặt (dev / unpacked)

1. Mở `chrome://extensions`.
2. Bật **Developer mode** (góc trên bên phải).
3. Bấm **Load unpacked** → chọn thư mục này (`/Users/macbook_115/Documents/ext`).
4. Bấm icon extension → **Mở trang cài đặt**.

## Cách dùng

1. Trong trang cài đặt, nhập tên bộ phím và mã gõ, sau đó chọn loại nội dung:
	- **Ảnh**: chọn ảnh rồi **Lưu**.
	- **Text**: nhập nội dung cần chèn rồi **Lưu**.
2. Vào một rich text editor (Gmail, Slack web, Notion, Messenger, Discord web, GitHub comment, v.v.), click vào ô soạn thảo.
3. Gõ mã rồi nhấn `Tab` → ảnh hoặc văn bản được chèn vào.

## Giới hạn & hành vi theo trang

- Văn bản có thể được chèn vào cả `<input>`, `<textarea>` và **rich text editor** (contenteditable). Ảnh vẫn chỉ chèn vào rich text editor.
- Ảnh lưu dưới dạng base64 trong `chrome.storage.local` (~10 MB tổng).
- Một số editor (Teams, Google Docs, Outlook Web) **từ chối synthetic paste event** vì `event.isTrusted === false`. Với các host này, extension sẽ **copy ảnh vào system clipboard** và toast báo "nhấn Ctrl/Cmd+V" — bạn cần nhấn 1 phím tắt paste nữa.
- Các host này hiện gồm: `teams.microsoft.com`, `teams.live.com`, `docs.google.com`, `outlook.office.com`, `outlook.office365.com`, `outlook.live.com` (xem `CLIPBOARD_FIRST_HOSTS` trong `content.js`).
- Với editor thường (Gmail, Slack, Notion, Messenger, Discord, GitHub…) extension chèn trực tiếp 1 phím tắt; nếu editor từ chối, fallback sang clipboard tự động.
- Mã gõ không phân biệt hoa thường và chỉ kích hoạt khi nhấn `Tab`.

## Cấu trúc

- `manifest.json` — MV3, permission `storage`, content script chạy mọi URL.
- `options.html` / `options.js` — trang quản lý danh sách bộ phím mã gõ ↔ ảnh hoặc văn bản.
- `content.js` — nghe mã gõ và phím `Tab`, chèn nội dung vào target đang focus.
- `popup.html` / `popup.js` — popup gọn để mở trang options.
