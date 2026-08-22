<?php
/* ═══ Paraveda CRM — Cloud Sync API ═══
   كايخدم فـ Hostinger (PHP) — كايخزن الداتا المشتركة فـ crm_data.json
   ارفعو فـ نفس البلاصة مع index.html
   ═════════════════════════════════════════════════════ */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type, X-Sync-Token');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { exit; }

$SECRET = 'paraveda-2026-sync'; // نفس القيمة فـ cloud.ts
$FILE = __DIR__ . '/crm_data.json';

$KEYS = [
  "afrizon_users_v1", "afrizon_orders_v5", "afrizon_agent_names_v1",
  "afrizon_chat_v1", "afrizon_worktimes_v1", "afrizon_remarques_v1",
  "afrizon_avances_v1", "afrizon_adspend_v1", "afrizon_perfrows_v1",
  "afrizon_history_v1", "afrizon_villes_v2", "afrizon_catalog_v1",
  "sheet_pièce", "afrizon_team_photos_v1", "tabs_list_v1", "custom_sheets_v1",
];

function load_all($FILE) {
  if (!file_exists($FILE)) return [];
  $s = @file_get_contents($FILE);
  if ($s === false) return [];
  $d = json_decode($s, true);
  return is_array($d) ? $d : [];
}
function save_all($FILE, $d) {
  @file_put_contents($FILE, json_encode($d, JSON_UNESCAPED_UNICODE), LOCK_EX);
}

$method = $_SERVER['REQUEST_METHOD'];

/* GET: كل الداتا */
if ($method === 'GET') {
  echo json_encode(load_all($FILE), JSON_UNESCAPED_UNICODE);
  exit;
}

/* POST: تحديث مفتاح */
if ($method === 'POST') {
  $token = $_SERVER['HTTP_X_SYNC_TOKEN'] ?? '';
  if (!hash_equals($SECRET, $token)) { http_response_code(403); echo '{"ok":false,"err":"token"}'; exit; }
  $body = json_decode(file_get_contents('php://input'), true);
  if (!isset($body['key'], $body['t'], $body['d'])) { http_response_code(400); echo '{"ok":false,"err":"body"}'; exit; }
  if (!in_array($body['key'], $KEYS, true)) { http_response_code(403); echo '{"ok":false,"err":"key"}'; exit; }
  $all = load_all($FILE);
  $cur = $all[$body['key']] ?? null;
  if ($cur === null || (int)$body['t'] >= (int)$cur['t']) {
    $all[$body['key']] = ['t' => (int)$body['t'], 'd' => $body['d']];
    save_all($FILE, $all);
    echo '{"ok":true,"fresh":true}';
  } else {
    echo '{"ok":true,"fresh":false}';
  }
  exit;
}

http_response_code(405); echo '{"ok":false}';
