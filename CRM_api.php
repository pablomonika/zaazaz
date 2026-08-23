<?php
/* ═══ Paraveda CRM — Cloud Sync API v2 ═══
   محسن: تشخيص تلقائي + إنشاء الملف أوتوماتيك + رسائل خطأ واضحة
   ═════════════════════════════════════════════════════ */

// وضع التشخيص: ?action=health
if (isset($_GET['action']) && $_GET['action'] === 'health') {
  header('Content-Type: application/json; charset=utf-8');
  $f = __DIR__ . '/crm_data.json';
  $canWrite = is_writable(__DIR__);
  $fileExists = file_exists($f);
  $fileWritable = $fileExists ? is_writable($f) : null;
  echo json_encode([
    'ok' => true,
    'php' => PHP_VERSION,
    'dir_writable' => $canWrite,
    'file_exists' => $fileExists,
    'file_writable' => $fileWritable,
    'path' => __DIR__,
  ], JSON_PRETTY_PRINT);
  exit;
}

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type, X-Sync-Token');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { exit; }

$SECRET = 'paraveda-2026-sync';
$FILE = __DIR__ . '/crm_data.json';

$KEYS = [
  "afrizon_users_v1", "afrizon_orders_v5", "afrizon_agent_names_v1",
  "afrizon_chat_v1", "afrizon_worktimes_v1", "afrizon_remarques_v1",
  "afrizon_avances_v1", "afrizon_adspend_v1", "afrizon_perfrows_v1",
  "afrizon_history_v1", "afrizon_villes_v2", "afrizon_catalog_v1",
  "sheet_pièce", "afrizon_team_photos_v1", "tabs_list_v1", "custom_sheets_v1",
];

function load_all($FILE) {
  if (!file_exists($FILE)) {
    // حاول يصاوب الملف
    @file_put_contents($FILE, '{}');
    return [];
  }
  $s = @file_get_contents($FILE);
  if ($s === false || $s === '') return [];
  $d = json_decode($s, true);
  return is_array($d) ? $d : [];
}

function save_all($FILE, $d) {
  $json = json_encode($d, JSON_UNESCAPED_UNICODE);
  if ($json === false) return false;
  $r = @file_put_contents($FILE, $json, LOCK_EX);
  return $r !== false;
}

$method = $_SERVER['REQUEST_METHOD'];

/* GET: كل الداتا */
if ($method === 'GET') {
  $all = load_all($FILE);
  if (json_last_error() !== JSON_ERROR_NONE) {
    echo '{"_err":"json_decode_failed"}';
    exit;
  }
  echo json_encode($all, JSON_UNESCAPED_UNICODE);
  exit;
}

/* POST: تحديث مفتاح */
if ($method === 'POST') {
  $token = $_SERVER['HTTP_X_SYNC_TOKEN'] ?? '';
  if (!hash_equals($SECRET, $token)) {
    http_response_code(403);
    echo json_encode(['ok' => false, 'err' => 'token', 'msg' => 'Token mismatch']);
    exit;
  }
  $raw = file_get_contents('php://input');
  $body = json_decode($raw, true);
  if (!isset($body['key'], $body['t'], $body['d'])) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'err' => 'body', 'msg' => 'Missing key/t/d', 'received' => substr($raw, 0, 100)]);
    exit;
  }
  if (!in_array($body['key'], $KEYS, true)) {
    http_response_code(403);
    echo json_encode(['ok' => false, 'err' => 'key', 'msg' => 'Key not allowed: ' . $body['key']]);
    exit;
  }
  $all = load_all($FILE);
  $cur = $all[$body['key']] ?? null;
  if ($cur === null || (int)$body['t'] >= (int)$cur['t']) {
    $all[$body['key']] = ['t' => (int)$body['t'], 'd' => $body['d']];
    if (save_all($FILE, $all)) {
      echo json_encode(['ok' => true, 'fresh' => true]);
    } else {
      http_response_code(500);
      echo json_encode(['ok' => false, 'err' => 'write', 'msg' => 'Cannot write to crm_data.json — check permissions (chmod 644 or 666)']);
    }
  } else {
    echo json_encode(['ok' => true, 'fresh' => false]);
  }
  exit;
}

http_response_code(405);
echo json_encode(['ok' => false, 'err' => 'method']);
