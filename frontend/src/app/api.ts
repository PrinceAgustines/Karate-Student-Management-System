/// <reference types="vite/client" />

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://127.0.0.1:8000";

function buildHeaders(hasAuth = false, accessTokenOrJson?: string | boolean, json = true) {
  const headers: Record<string, string> = {};
  let accessToken: string | undefined = undefined;

  if (typeof accessTokenOrJson === "boolean") {
    json = accessTokenOrJson;
  } else {
    accessToken = accessTokenOrJson;
  }

  if (json) {
    headers["Content-Type"] = "application/json";
  }

  if (hasAuth) {
    const token = accessToken ?? window.localStorage.getItem("karate-management-access-token");
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  return headers;
}

function buildQueryString(params?: Record<string, string | number | boolean | undefined>) {
  if (!params) return '';
  const query = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&');
  return query ? `?${query}` : '';
}

function extractErrorMessage(payload: any): string | null {
  if (!payload || typeof payload !== "object") return null;

  if (Array.isArray(payload)) {
    return payload.filter(Boolean).join(" ") || null;
  }

  for (const key of Object.keys(payload)) {
    const value = payload[key];
    if (typeof value === "string") {
      return value;
    }
    if (Array.isArray(value)) {
      return value.filter(Boolean).join(" ") || null;
    }
    if (typeof value === "object") {
      const nested = extractErrorMessage(value);
      if (nested) return nested;
    }
  }
  return null;
}

async function handleResponse(response: Response) {
  const json = await response.json().catch(() => null);
  if (!response.ok) {
    const error = json?.detail || json?.message || extractErrorMessage(json) || "Unknown error";
    throw new Error(error);
  }
  return json;
}

export async function loginUser(email: string, password: string) {
  const response = await fetch(`${API_BASE}/api/users/login/`, {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify({ email, password }),
  });
  return handleResponse(response);
}

export async function loginParent(parentId: string, password: string) {
  const response = await fetch(`${API_BASE}/api/users/parent-login/`, {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify({ parent_id: parentId, password }),
  });
  return handleResponse(response);
}

export async function fetchMe(accessToken?: string) {
  const response = await fetch(`${API_BASE}/api/users/me/`, {
    method: "GET",
    headers: buildHeaders(true, accessToken),
  });
  return handleResponse(response);
}

export async function updateMe(payload: Record<string, any>) {
  const response = await fetch(`${API_BASE}/api/users/me/`, {
    method: "PATCH",
    headers: buildHeaders(true),
    body: JSON.stringify(payload),
  });
  return handleResponse(response);
}

export async function registerStudent(payload: Record<string, any>) {
  const response = await fetch(`${API_BASE}/api/students/register/`, {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify(payload),
  });
  return handleResponse(response);
}

export async function verifySystemId(code: string) {
  const response = await fetch(`${API_BASE}/api/students/verify-id/`, {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify({ code }),
  });
  return handleResponse(response);
}

export async function fetchStudents() {
  const response = await fetch(`${API_BASE}/api/students/students/`, {
    method: "GET",
    headers: buildHeaders(true),
  });
  return handleResponse(response);
}

export async function fetchAvailableStudents() {
  const response = await fetch(`${API_BASE}/api/students/students/all-students/`, {
    method: "GET",
    headers: buildHeaders(true),
  });
  return handleResponse(response);
}

export async function fetchSystemIds() {
  const response = await fetch(`${API_BASE}/api/students/system-ids/`, {
    method: "GET",
    headers: buildHeaders(true),
  });
  return handleResponse(response);
}

export async function generateSystemIds(payload: { id_type: string; quantity: number }) {
  const response = await fetch(`${API_BASE}/api/students/system-ids/`, {
    method: "POST",
    headers: buildHeaders(true),
    body: JSON.stringify(payload),
  });
  return handleResponse(response);
}

export async function updateSystemId(systemId: number, payload: Record<string, any>) {
  const response = await fetch(`${API_BASE}/api/students/system-ids/${systemId}/`, {
    method: "PATCH",
    headers: buildHeaders(true),
    body: JSON.stringify(payload),
  });
  return handleResponse(response);
}

export async function deleteSystemId(systemId: number) {
  const response = await fetch(`${API_BASE}/api/students/system-ids/${systemId}/`, {
    method: "DELETE",
    headers: buildHeaders(true),
  });
  return handleResponse(response);
}

export async function fetchStudentById(studentId: string | number) {
  const response = await fetch(`${API_BASE}/api/students/students/${studentId}/`, {
    method: "GET",
    headers: buildHeaders(true),
  });
  return handleResponse(response);
}

export async function updateStudentById(studentId: string | number, payload: Record<string, any>) {
  const response = await fetch(`${API_BASE}/api/students/students/${studentId}/`, {
    method: "PATCH",
    headers: buildHeaders(true),
    body: JSON.stringify(payload),
  });
  return handleResponse(response);
}

export async function deleteStudentById(studentId: string | number) {
  const response = await fetch(`${API_BASE}/api/students/students/${studentId}/`, {
    method: "DELETE",
    headers: buildHeaders(true),
  });
  return handleResponse(response);
}

export async function fetchAttendanceLogs() {
  const response = await fetch(`${API_BASE}/api/students/attendances/`, {
    method: "GET",
    headers: buildHeaders(true),
  });
  return handleResponse(response);
}

export async function recordBatchAttendance(sessionId: number, attendanceData: any[]) {
  const response = await fetch(`${API_BASE}/api/students/facial-recognition/record_batch_attendance/`, {
    method: "POST",
    headers: buildHeaders(true),
    body: JSON.stringify({
      session_id: sessionId,
      attendance: attendanceData
    }),
  });
  return handleResponse(response);
}

export async function recordManualAttendance(sessionId: number, attendanceData: any[]) {
  const response = await fetch(`${API_BASE}/api/students/facial-recognition/record_manual_attendance/`, {
    method: "POST",
    headers: buildHeaders(true),
    body: JSON.stringify({
      session_id: sessionId,
      attendance: attendanceData
    }),
  });
  return handleResponse(response);
}

export async function fetchNotifications() {
  const response = await fetch(`${API_BASE}/api/students/notifications/`, {
    method: "GET",
    headers: buildHeaders(true),
  });
  return handleResponse(response);
}

export async function markNotificationRead(notificationId: number, isRead = true) {
  const response = await fetch(`${API_BASE}/api/students/notifications/${notificationId}/`, {
    method: "PATCH",
    headers: buildHeaders(true),
    body: JSON.stringify({ is_read: isRead }),
  });
  return handleResponse(response);
}

export async function markAllNotificationsRead() {
  const response = await fetch(`${API_BASE}/api/students/notifications/mark_all_read/`, {
    method: "POST",
    headers: buildHeaders(true),
  });
  return handleResponse(response);
}

export async function deleteNotification(notificationId: number) {
  const response = await fetch(`${API_BASE}/api/students/notifications/${notificationId}/`, {
    method: "DELETE",
    headers: buildHeaders(true),
  });
  return handleResponse(response);
}

export async function fetchInventory() {
  const response = await fetch(`${API_BASE}/api/students/inventories/`, {
    method: "GET",
    headers: buildHeaders(true),
  });
  return handleResponse(response);
}

export async function createInventoryItem(payload: FormData | Record<string, any>) {
  const response = await fetch(`${API_BASE}/api/students/inventories/`, {
    method: "POST",
    headers: buildHeaders(true, payload instanceof FormData ? false : true),
    body: payload instanceof FormData ? payload : JSON.stringify(payload),
  });
  return handleResponse(response);
}

export async function updateInventoryItem(itemId: number | string, payload: FormData | Record<string, any>) {
  const response = await fetch(`${API_BASE}/api/students/inventories/${itemId}/`, {
    method: "PATCH",
    headers: buildHeaders(true, payload instanceof FormData ? false : true),
    body: payload instanceof FormData ? payload : JSON.stringify(payload),
  });
  return handleResponse(response);
}

export async function deleteInventoryItem(itemId: number | string) {
  const response = await fetch(`${API_BASE}/api/students/inventories/${itemId}/`, {
    method: "DELETE",
    headers: buildHeaders(true),
  });
  return handleResponse(response);
}

export async function fetchStanceEvaluations() {
  const response = await fetch(`${API_BASE}/api/students/stance-evaluations/`, {
    method: "GET",
    headers: buildHeaders(true),
  });
  return handleResponse(response);
}

export async function fetchPoseLabelChoices() {
  const response = await fetch(`${API_BASE}/api/students/pose-templates/label-choices/`, {
    method: 'GET',
    headers: buildHeaders(true),
  });
  return handleResponse(response);
}

export async function analyzePoseEvaluation(studentId: number, media: File) {
  const formData = new FormData();
  formData.append('student_id', String(studentId));
  formData.append('media', media);

  const response = await fetch(`${API_BASE}/api/students/stance-evaluations/analyze/`, {
    method: 'POST',
    headers: buildHeaders(true, undefined, false),
    body: formData,
  });
  return handleResponse(response);
}

export async function uploadPoseTemplate(formData: FormData) {
  const response = await fetch(`${API_BASE}/api/students/pose-templates/`, {
    method: 'POST',
    headers: buildHeaders(true, undefined, false),
    body: formData,
  });
  return handleResponse(response);
}

export async function updateStanceEvaluation(evaluationId: number, payload: Record<string, any>) {
  const response = await fetch(`${API_BASE}/api/students/stance-evaluations/${evaluationId}/`, {
    method: 'PATCH',
    headers: buildHeaders(true),
    body: JSON.stringify(payload),
  });
  return handleResponse(response);
}

export async function fetchInstructorRatings() {
  const response = await fetch(`${API_BASE}/api/students/instructor-ratings/`, {
    method: "GET",
    headers: buildHeaders(true),
  });
  return handleResponse(response);
}

export async function fetchPerformanceSummaries(params?: { student_id?: number; period?: string }) {
  const query = buildQueryString(params);
  const response = await fetch(`${API_BASE}/api/students/performance-summaries/${query}`, {
    method: "GET",
    headers: buildHeaders(true),
  });
  return handleResponse(response);
}

export async function fetchBeltProgressionIndicators(params?: { student_id?: number; readiness_status?: string }) {
  const query = buildQueryString(params);
  const response = await fetch(`${API_BASE}/api/students/belt-progression-indicators/${query}`, {
    method: "GET",
    headers: buildHeaders(true),
  });
  return handleResponse(response);
}

export async function fetchProgressionInsights(params?: { student_id?: number; insight_type?: string }) {
  const query = buildQueryString(params);
  const response = await fetch(`${API_BASE}/api/students/progression-insights/${query}`, {
    method: "GET",
    headers: buildHeaders(true),
  });
  return handleResponse(response);
}

export async function fetchAnalyticsOverview() {
  const response = await fetch(`${API_BASE}/api/students/analytics/overview/`, {
    method: "GET",
    headers: buildHeaders(true),
  });
  return handleResponse(response);
}

export async function fetchStudentPerformanceDashboard(studentId: string | number) {
  const response = await fetch(`${API_BASE}/api/students/students/${studentId}/performance-dashboard/`, {
    method: "GET",
    headers: buildHeaders(true),
  });
  return handleResponse(response);
}

export async function fetchGamificationLeaderboard() {
  const response = await fetch(`${API_BASE}/api/students/students/gamification/leaderboard/`, {
    method: "GET",
    headers: buildHeaders(true),
  });
  return handleResponse(response);
}

export async function fetchGamificationBadgeSummaries() {
  const response = await fetch(`${API_BASE}/api/students/students/gamification/badges/`, {
    method: "GET",
    headers: buildHeaders(true),
  });
  return handleResponse(response);
}

export async function fetchGamificationBadgeStudents(badgeId: string | number) {
  const response = await fetch(`${API_BASE}/api/students/students/gamification/badges/${badgeId}/students/`, {
    method: "GET",
    headers: buildHeaders(true),
  });
  return handleResponse(response);
}

export async function generateStudentProgression(studentId: string | number, period: string = 'monthly') {
  const response = await fetch(`${API_BASE}/api/students/students/${studentId}/generate-progression/`, {
    method: "POST",
    headers: buildHeaders(true),
    body: JSON.stringify({ period }),
  });
  return handleResponse(response);
}

export async function fetchSessions() {
  const response = await fetch(`${API_BASE}/api/students/sessions/`, {
    method: "GET",
    headers: buildHeaders(true),
  });
  return handleResponse(response);
}

export async function createSession(payload: Record<string, any>) {
  const response = await fetch(`${API_BASE}/api/students/sessions/`, {
    method: "POST",
    headers: buildHeaders(true),
    body: JSON.stringify(payload),
  });
  return handleResponse(response);
}

export async function updateSession(sessionId: number, payload: Record<string, any>) {
  const response = await fetch(`${API_BASE}/api/students/sessions/${sessionId}/`, {
    method: "PATCH",
    headers: buildHeaders(true),
    body: JSON.stringify(payload),
  });
  return handleResponse(response);
}

export async function deleteSession(sessionId: number) {
  const response = await fetch(`${API_BASE}/api/students/sessions/${sessionId}/`, {
    method: "DELETE",
    headers: buildHeaders(true),
  });
  return handleResponse(response);
}

export async function registerInstructor(payload: Record<string, any>) {
  const response = await fetch(`${API_BASE}/api/users/register/`, {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify(payload),
  });
  return handleResponse(response);
}

export async function registerParent(payload: Record<string, any>) {
  const response = await fetch(`${API_BASE}/api/users/register/`, {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify(payload),
  });
  return handleResponse(response);
}

// E-Commerce API Functions

export async function fetchProducts(params?: { category?: string; search?: string }) {
  const queryString = buildQueryString(params);
  const response = await fetch(`${API_BASE}/api/students/products/${queryString}`, {
    method: "GET",
    headers: buildHeaders(false),
  });
  return handleResponse(response);
}

export async function fetchProductDetail(id: number) {
  const response = await fetch(`${API_BASE}/api/students/products/${id}/`, {
    method: "GET",
    headers: buildHeaders(false),
  });
  return handleResponse(response);
}

export async function getCart() {
  const response = await fetch(`${API_BASE}/api/students/cart/my_cart/`, {
    method: "GET",
    headers: buildHeaders(true),
  });
  return handleResponse(response);
}

export async function addToCart(inventoryItemId: number, quantity: number) {
  const response = await fetch(`${API_BASE}/api/students/cart/add_item/`, {
    method: "POST",
    headers: buildHeaders(true),
    body: JSON.stringify({ inventory_item_id: inventoryItemId, quantity }),
  });
  return handleResponse(response);
}

export async function updateCartItem(cartItemId: number, quantity: number) {
  const response = await fetch(`${API_BASE}/api/students/cart/update_item/`, {
    method: "POST",
    headers: buildHeaders(true),
    body: JSON.stringify({ cart_item_id: cartItemId, quantity }),
  });
  return handleResponse(response);
}

export async function removeFromCart(cartItemId: number) {
  const response = await fetch(`${API_BASE}/api/students/cart/remove_item/`, {
    method: "POST",
    headers: buildHeaders(true),
    body: JSON.stringify({ cart_item_id: cartItemId }),
  });
  return handleResponse(response);
}

export async function clearCart() {
  const response = await fetch(`${API_BASE}/api/students/cart/clear_cart/`, {
    method: "POST",
    headers: buildHeaders(true),
  });
  return handleResponse(response);
}

export async function createOrder(payload: Record<string, any>) {
  const response = await fetch(`${API_BASE}/api/students/orders/create_order/`, {
    method: "POST",
    headers: buildHeaders(true),
    body: JSON.stringify(payload),
  });
  return handleResponse(response);
}

export async function getMyOrders() {
  const response = await fetch(`${API_BASE}/api/students/orders/my_orders/`, {
    method: "GET",
    headers: buildHeaders(true),
  });
  return handleResponse(response);
}

export async function getPendingOrders() {
  const response = await fetch(`${API_BASE}/api/students/orders/pending_orders/`, {
    method: "GET",
    headers: buildHeaders(true),
  });
  return handleResponse(response);
}

export async function getAllOrders() {
  const response = await fetch(`${API_BASE}/api/students/orders/all_orders/`, {
    method: "GET",
    headers: buildHeaders(true),
  });
  return handleResponse(response);
}

export async function confirmOrder(orderId: number, adminNotes?: string) {
  const response = await fetch(`${API_BASE}/api/students/orders/confirm_order/`, {
    method: "POST",
    headers: buildHeaders(true),
    body: JSON.stringify({ order_id: orderId, admin_notes: adminNotes || "" }),
  });
  return handleResponse(response);
}

export async function completeOrder(orderId: number) {
  const response = await fetch(`${API_BASE}/api/students/orders/complete_order/`, {
    method: "POST",
    headers: buildHeaders(true),
    body: JSON.stringify({ order_id: orderId }),
  });
  return handleResponse(response);
}

export async function cancelOrder(orderId: number) {
  const response = await fetch(`${API_BASE}/api/students/orders/cancel_order/`, {
    method: "POST",
    headers: buildHeaders(true),
    body: JSON.stringify({ order_id: orderId }),
  });
  return handleResponse(response);
}

// Parent-Student API Functions

export async function fetchMyChildren() {
  const response = await fetch(`${API_BASE}/api/students/parent-students/my-children/`, {
    method: "GET",
    headers: buildHeaders(true),
  });
  return handleResponse(response);
}

export async function addChildToParent(studentId: string, relationship: string) {
  const response = await fetch(`${API_BASE}/api/students/parent-students/add-child/`, {
    method: "POST",
    headers: buildHeaders(true),
    body: JSON.stringify({ student_id: studentId, relationship }),
  });
  return handleResponse(response);
}

export async function removeChildFromParent(relationshipId: number) {
  const response = await fetch(`${API_BASE}/api/students/parent-students/${relationshipId}/`, {
    method: "DELETE",
    headers: buildHeaders(true),
  });
  return handleResponse(response);
}
