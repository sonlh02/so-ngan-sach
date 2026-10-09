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
   - Bật **Chi tiêu thông minh** để app tự chia thu nhập theo % cho từng hạng mục; đổi thu nhập thì ngân sách tự tính lại. Tích **Cố định** để khoá % của một hạng mục, bỏ tích để sửa % (hoặc sửa thẳng số tiền). Khi sửa một mục, các mục chưa cố định tự co giãn theo tỉ lệ để tổng luôn đủ 100%.
3. **Nhật ký chi tiêu** — ghi từng khoản chi. Gõ tắt được: `50k`, `1.5tr`, `2ty`.
   - Tích **Lặp lại hằng tháng** khi ghi (hoặc sửa) một khoản để biến nó thành khoản cố định: từ tháng sau app tự ghi khoản đó vào sổ, đúng ngày và hạng mục, ngay lần đầu mở app trong tháng. Danh sách khoản cố định nằm ngay dưới form.
4. Sang tháng mới, bấm **Chép từ tháng trước** để dùng lại kế hoạch.

Thanh tiến độ của mỗi hạng mục có vạch đánh dấu "hôm nay": thanh chạy vượt vạch nghĩa là đang tiêu nhanh hơn tiến độ tháng.

**Báo cáo** ở cuối trang so sánh 6 tháng gần nhất: biểu đồ đã chi so với kế hoạch, bảng chi theo hạng mục từng tháng (▲ = vượt kế hoạch), mức chi trung bình, tỉ lệ để dành và hạng mục hay vượt nhất.

**Sao lưu / Khôi phục** ở cuối trang dùng để giữ một bản dữ liệu ngoài trình duyệt hoặc chuyển sang máy khác (tệp JSON; trên điện thoại sẽ mở bảng chia sẻ để lưu vào Tệp/Drive). App tự nhắc khi có thay đổi mà chưa sao lưu: sau 3 ngày nếu chưa sao lưu lần nào, sau đó mỗi 14 ngày.

## Cấu trúc

- `index.html` — khung trang
- `styles.css` — giao diện
- `app.js` — dữ liệu, tính toán, hiển thị
- `server.js` — máy chủ tĩnh cho `npm start`
