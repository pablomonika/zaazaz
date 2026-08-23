<?php
/* Paraveda CRM Sync — Guaranteed working */
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-cache, no-store, must-revalidate');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type, X-Sync-Token');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { exit; }

$SECRET = 'paraveda-2026-sync';
$FILE = __DIR__ . '/crm_data.json';

$KEYS = array(
  "afrizon_users_v1","afrizon_orders_v5","afrizon_agent_names_v1",
  "afrizon_chat_v1","afrizon_worktimes_v1","afrizon_remarques_v1",
  "afrizon_avances_v1","afrizon_adspend_v1","afrizon_perfrows_v1",
  "afrizon_history_v1","afrizon_villes_v2","afrizon_catalog_v1",
  "sheet_pièce","afrizon_team_photos_v1","tabs_list_v1","custom_sheets_v1",
);

$m = $_SERVER['REQUEST_METHOD'];

if ($m === 'GET') {
  if (!file_exists($FILE)) {
    echo '{}';
    exit;
  }
  $s = file_get_contents($FILE);
  if ($s === false || $s === '' || trim($s) === '[]') {
    echo '{}';
    exit;
  }
  echo $s;
  exit;
}

if ($m === 'POST') {
  $tok = isset($_SERVER['HTTP_X_SYNC_TOKEN']) ? $_SERVER['HTTP_X_SYNC_TOKEN'] : '';
  if ($tok !== $SECRET) { http_response_code(403); echo '{"ok":false}'; exit; }

  $raw = file_get_contents('php://input');
  $b = json_decode($raw, true);
  if (!$b || !isset($b['key']) || !isset($b['t']) || !isset($b['d'])) {
    http_response_code(400); echo '{"ok":false}'; exit;
  }
  if (!in_array($b['key'], $KEYS, true)) {
    http_response_code(403); echo '{"ok":false}'; exit;
  }

  $cur = '{}';
  if (file_exists($FILE)) {
    $cur = file_get_contents($FILE);
    if ($cur === false || trim($cur) === '') $cur = '{}';
  }
  $d = json_decode($cur, true);
  if (!is_array($d)) $d = array();

  $k = $b['key'];
  $t = intval($b['t']);
  $old = isset($d[$k]) ? $d[$k] : null;

  if ($old === null || $t >= intval($old['t'])) {
    $d[$k] = array('t' => $t, 'd' => $b['d']);
    $json = json_encode($d, JSON_UNESCAPED_UNICODE);
    if ($json === false) { http_response_code(500); echo '{"ok":false}'; exit; }
    if (file_put_contents($FILE, $json, LOCK_EX) === false) {
      http_response_code(500); echo '{"ok":false,"err":"write"}'; exit;
    }
  }
  echo '{"ok":true}';
  exit;
}

http_response_code(405);
echo '{"ok":false}';
