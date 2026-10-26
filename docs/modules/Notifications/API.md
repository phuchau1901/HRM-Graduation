# Notifications — API

[Module](README.md) · [Quy ước chung](../../guides/CONVENTIONS.md) · [Postman](../../HRM-API.postman_collection.json)

| Method | URL | Quyền |
| --- | --- | --- |
| GET | `/api/notifications` | JWT + recipient ownership |
| GET | `/api/notifications/unread-count` | JWT + recipient ownership |
| PATCH | `/api/notifications/{notificationId}/read` | JWT + recipient ownership |
| PATCH | `/api/notifications/read-all` | JWT + recipient ownership |
| POST | `/api/notifications/announcements` | SEND_USER / SEND_GROUP / SEND_ALL theo target; thêm SCHEDULE khi có lịch |
| POST | `/api/notifications/{notificationId}/publish` | Action gửi theo target đã lưu; SCHEDULE khi có lịch |
| POST | `/api/notifications/{notificationId}/cancel` | WEB_NOTIFICATIONS / CANCEL |

## GET /api/notifications

Inbox riêng của JWT sub.

- Role/Permission: **JWT; recipient ownership**.
- Query/Path/Header: Query limit=30 (clamp 1–100), beforeId nullable (cursor ID).
- HTTP errors: 401, 500.
- Validation/nghiệp vụ: Chỉ PUBLISHED và user hiện tại; không tin userId query. Offline đồng bộ API.

JSON Request mẫu:

Không có body.

JSON Response thành công — HTTP 200:

```json
{
  "items": [
    {
      "id": 1,
      "title": "Thông báo",
      "content": "Mở ứng dụng để xem thông tin.",
      "source": "SYSTEM",
      "createdAt": "2026-10-24T10:00:00Z",
      "publishedAt": "2026-10-24T10:00:01Z",
      "readAt": null,
      "referenceType": "EMPLOYEE",
      "referenceId": "1"
    }
  ],
  "nextBeforeId": null
}
```

### Kiểm thử endpoint

Kiểm tra JWT401; ownership khi xem/đánh dấu; quyền gửi đúng target; thiếu SEND_ALL trả403; retry cùng idempotency key không tạo nội dung trùng; phát hành qua worker trước khi kiểm tra inbox.

## GET /api/notifications/unread-count

Đếm chưa đọc.

- Role/Permission: **JWT; recipient ownership**.
- Query/Path/Header: Không có query/path/body.
- HTTP errors: 401, 500.
- Validation/nghiệp vụ: Chỉ thông báo đã phát hành của sub.

JSON Request mẫu:

Không có body.

JSON Response thành công — HTTP 200:

```json
{
  "count": 1
}
```

### Kiểm thử endpoint

Kiểm tra JWT401; ownership khi xem/đánh dấu; quyền gửi đúng target; thiếu SEND_ALL trả403; retry cùng idempotency key không tạo nội dung trùng; phát hành qua worker trước khi kiểm tra inbox.

## PATCH /api/notifications/{notificationId}/read

Đánh dấu một thông báo.

- Role/Permission: **JWT; recipient ownership**.
- Query/Path/Header: Path notificationId BIGINT.
- HTTP errors: 401, 404, 500.
- Validation/nghiệp vụ: Idempotent; non-recipient trả 404.

JSON Request mẫu:

Không có body.

JSON Response thành công — HTTP 204:

Không có body.

### Kiểm thử endpoint

Kiểm tra JWT401; ownership khi xem/đánh dấu; quyền gửi đúng target; thiếu SEND_ALL trả403; retry cùng idempotency key không tạo nội dung trùng; phát hành qua worker trước khi kiểm tra inbox.

## PATCH /api/notifications/read-all

Đánh dấu toàn bộ inbox hiện tại.

- Role/Permission: **JWT; recipient ownership**.
- Query/Path/Header: Không có query/path/body.
- HTTP errors: 401, 500.
- Validation/nghiệp vụ: Không thay đổi trạng thái đọc của user khác.

JSON Request mẫu:

Không có body.

JSON Response thành công — HTTP 200:

```json
{
  "updated": 1
}
```

### Kiểm thử endpoint

Kiểm tra JWT401; ownership khi xem/đánh dấu; quyền gửi đúng target; thiếu SEND_ALL trả403; retry cùng idempotency key không tạo nội dung trùng; phát hành qua worker trước khi kiểm tra inbox.

## POST /api/notifications/announcements

Lưu announcement draft hoặc lịch.

- Role/Permission: **WEB_NOTIFICATIONS: USER→SEND_USER; USERS/ROLE/DEPARTMENT/CUSTOM→SEND_GROUP; ALL→SEND_ALL; thêm SCHEDULE khi có scheduledAt**.
- Query/Path/Header: Header Idempotency-Key bắt buộc <=100 ký tự; scheduledAt UTC tương lai tùy chọn.
- HTTP errors: 400, 401, 403, 409, 500.
- Validation/nghiệp vụ: Target allowlist/OR/distinct, không SQL; cùng key khác payload 409. Worker xử lý sau. Xem [kiến trúc phân phối](ARCHITECTURE.md) cho đầy đủ target.

JSON Request mẫu:

```json
{
  "title": "Thông báo demo",
  "content": "Vui lòng mở ứng dụng để kiểm tra.",
  "targets": [
    {
      "type": "USER",
      "userIds": [
        "{{targetUserId}}"
      ]
    }
  ]
}
```

JSON Response thành công — HTTP 201:

```json
{
  "id": 1,
  "status": "DRAFT",
  "scheduledAt": null,
  "recipientCount": 0
}
```

### Kiểm thử endpoint

Kiểm tra JWT401; ownership khi xem/đánh dấu; quyền gửi đúng target; thiếu SEND_ALL trả403; retry cùng idempotency key không tạo nội dung trùng; phát hành qua worker trước khi kiểm tra inbox.

## POST /api/notifications/{notificationId}/publish

Đưa draft vào outbox.

- Role/Permission: **WEB_NOTIFICATIONS: kiểm tra từng quyền gửi của target đã lưu; SCHEDULE nếu có lịch**.
- Query/Path/Header: Path notificationId BIGINT.
- HTTP errors: 401, 403, 404, 409, 500.
- Validation/nghiệp vụ: Không fanout đồng bộ HTTP. Không publish source nội bộ qua API này.

JSON Request mẫu:

Không có body.

JSON Response thành công — HTTP 202:

```json
{
  "id": 1,
  "status": "SCHEDULED",
  "scheduledAt": null,
  "recipientCount": 0
}
```

### Kiểm thử endpoint

Kiểm tra JWT401; ownership khi xem/đánh dấu; quyền gửi đúng target; thiếu SEND_ALL trả403; retry cùng idempotency key không tạo nội dung trùng; phát hành qua worker trước khi kiểm tra inbox.

## POST /api/notifications/{notificationId}/cancel

Hủy trước phát hành.

- Role/Permission: **WEB_NOTIFICATIONS / CANCEL**.
- Query/Path/Header: Path notificationId BIGINT.
- HTTP errors: 401, 403, 404, 409, 500.
- Validation/nghiệp vụ: Chỉ DRAFT/SCHEDULED; PUBLISHED trả 409; cancel lặp idempotent.

JSON Request mẫu:

Không có body.

JSON Response thành công — HTTP 200:

```json
{
  "id": 1,
  "status": "CANCELLED",
  "scheduledAt": null,
  "recipientCount": 0
}
```

### Kiểm thử endpoint

Kiểm tra JWT401; ownership khi xem/đánh dấu; quyền gửi đúng target; thiếu SEND_ALL trả403; retry cùng idempotency key không tạo nội dung trùng; phát hành qua worker trước khi kiểm tra inbox.
