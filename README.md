# Sổ ngân sách tháng

App web lập kế hoạch và theo dõi chi tiêu theo từng tháng. Không cần cài thư viện; dữ liệu lưu trong `localStorage` của trình duyệt.

## Chạy

```bash
npm start
```

Rồi mở http://localhost:5173 (hoặc mở thẳng `index.html`).

## Cách dùng

1. **Thu nhập** — nhập các nguồn thu dự kiến của tháng.
2. **Kế hoạch** — chia thu nhập vào các hạng mục thuộc 3 nhóm *Thiết yếu / Mong muốn / Tiết kiệm* (gợi ý 50/30/20) cho tới khi "Chưa phân bổ" về 0.
3. **Nhật ký chi tiêu** — ghi từng khoản chi. Gõ tắt được: `50k`, `1.5tr`, `2ty`.
4. Sang tháng mới, bấm **Chép từ tháng trước** để dùng lại kế hoạch.

Thanh tiến độ của mỗi hạng mục có vạch đánh dấu "hôm nay": thanh chạy vượt vạch nghĩa là đang tiêu nhanh hơn tiến độ tháng.

**Xuất / Nhập dữ liệu** ở cuối trang dùng để sao lưu hoặc chuyển sang máy khác (tệp JSON).

## Cấu trúc

- `index.html` — khung trang
- `styles.css` — giao diện
- `app.js` — dữ liệu, tính toán, hiển thị
- `server.js` — máy chủ tĩnh cho `npm start`
