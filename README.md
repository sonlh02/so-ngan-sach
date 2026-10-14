# Sổ ngân sách tháng

App web lập kế hoạch và theo dõi chi tiêu theo từng tháng. Không cần cài thư viện; dữ liệu lưu trong `localStorage` của trình duyệt.

## Chạy

```bash
npm start
```

Rồi mở http://localhost:5173 (hoặc mở thẳng `index.html`).

## Cách dùng

App chia thành 5 tab ở thanh dưới:

- **Nhập vào** — hai chế độ:
  - **Tiền chi**: chọn ngày, ghi chú, số tiền (gõ tắt được `50k`, `1.5tr`, `2ty`), chạm một danh mục rồi bấm *Nhập khoản chi*. Bên dưới hiện số tiền còn lại của danh mục đó. Tích **Lặp lại hằng tháng** để app tự ghi khoản này vào các tháng sau.
  - **Tiền thu**: nhập khoản thu (lương, thưởng, …). App bật **Chi tiêu thông minh** cho tháng đó và tự chia tổng thu vào từng hạng mục theo % (mặc định theo khung 50/30/20); phần xem trước hiện số tiền từng mục trước khi bấm.
- **Lịch** — lịch tháng với tổng thu/chi mỗi ngày và danh sách mọi khoản; chạm một khoản để sửa hoặc xoá.
- **Báo cáo** — so sánh 6 tháng gần nhất: đã chi so với kế hoạch, bảng chi theo hạng mục (▲ = vượt), chi trung bình, tỉ lệ để dành.
- **Ngân sách** — các hạng mục theo nhóm *Thiết yếu / Mong muốn / Tiết kiệm*: sửa tên, số tiền, %; tích **Cố định** để khoá % một mục (các mục khác tự co giãn để tổng luôn 100%); thêm/xoá hạng mục. Thanh tiến độ có vạch "hôm nay": vượt vạch là đang tiêu nhanh hơn tiến độ tháng.
- **Khác** — sao lưu / khôi phục dữ liệu (tệp JSON; trên điện thoại mở bảng chia sẻ), danh sách khoản cố định hằng tháng.

Tháng mới tự dùng lại bộ hạng mục và % của tháng trước. Giao diện sáng/tối theo cài đặt của máy.

## Cấu trúc

- `index.html` — khung trang
- `styles.css` — giao diện
- `app.js` — dữ liệu, tính toán, hiển thị
- `server.js` — máy chủ tĩnh cho `npm start`
