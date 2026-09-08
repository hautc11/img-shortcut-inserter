# Image Shortcut Paster

Chrome extension: lưu nhiều cặp (tổ hợp phím ↔ ảnh) rồi paste ảnh vào rich text editor bằng phím tắt.

## Cài đặt (dev / unpacked)

1. Mở `chrome://extensions`.
2. Bật **Developer mode** (góc trên bên phải).
3. Bấm **Load unpacked** → chọn thư mục này (`/Users/macbook_115/Documents/ext`).
4. Bấm icon extension → **Mở trang cài đặt**.

## Cách dùng

1. Trong trang cài đặt: nhập tên, bấm **Capture** rồi nhấn tổ hợp phím mong muốn (phải có ít nhất 1 modifier), chọn ảnh, **Lưu**.
2. Vào một rich text editor (Gmail, Slack web, Notion, Messenger, Discord web, GitHub comment, v.v.), click vào ô soạn thảo.
3. Nhấn tổ hợp phím → ảnh được chèn vào.

## Giới hạn & hành vi theo trang

- Chỉ hoạt động với **rich text editor** (contenteditable). `<input>` / `<textarea>` thuần không nhận được ảnh — extension sẽ báo lỗi nổi lên góc phải.
- Ảnh lưu dưới dạng base64 trong `chrome.storage.local` (~10 MB tổng).
- Một số editor (Teams, Google Docs, Outlook Web) **từ chối synthetic paste event** vì `event.isTrusted === false`. Với các host này, extension sẽ **copy ảnh vào system clipboard** và toast báo "nhấn Ctrl/Cmd+V" — bạn cần nhấn 1 phím tắt paste nữa.
- Các host này hiện gồm: `teams.microsoft.com`, `teams.live.com`, `docs.google.com`, `outlook.office.com`, `outlook.office365.com`, `outlook.live.com` (xem `CLIPBOARD_FIRST_HOSTS` trong `content.js`).
- Với editor thường (Gmail, Slack, Notion, Messenger, Discord, GitHub…) extension chèn trực tiếp 1 phím tắt; nếu editor từ chối, fallback sang clipboard tự động.
- Shortcut được nghe ở content script phase capture, thắng phần lớn shortcut trang. Vẫn tránh trùng shortcut cấp Chrome (Ctrl+T, Ctrl+W, Ctrl+N…).

## Cấu trúc

- `manifest.json` — MV3, permission `storage`, content script chạy mọi URL.
- `options.html` / `options.js` — trang quản lý danh sách cặp shortcut ↔ ảnh.
- `content.js` — nghe keydown, chèn ảnh vào target đang focus.
- `popup.html` / `popup.js` — popup gọn để mở trang options.
