<?php
/* Paraveda CRM Sync API — Simplified & Bulletproof */
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

function load_all($f) {
  if (!file_exists($f)) { @file_put_contents($f, '{}'); return array(); }
  $s = @file_get_contents($f);
  if ($s === false || $s === '') return array();
  $d = json_decode($s, true);
  return is_array($d) ? $d : array();
}

function save_all($f, $d) {
  return @file_put_contents($f, json_encode($d, JSON_UNESCAPED_UNICODE), LOCK_EX) !== false;
}

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
  $all = load_all($FILE);
  if (empty($all)) {
    echo '{}';
  } else {
    echo json_encode($all, JSON_UNESCAPED_UNICODE);
  }
  exit;
}

if ($method === 'POST') {
  $token = isset($_SERVER['HTTP_X_SYNC_TOKEN']) ? $_SERVER['HTTP_X_SYNC_TOKEN'] : '';
  if ($token !== $SECRET) {
    http_response_code(403);
    echo '{"ok":false}';
    exit;
  }
  $raw = file_get_contents('php://input');
  $body = json_decode($raw, true);
  if (!isset($body['key']) || !isset($body['t']) || !isset($body['d'])) {
    http_response_code(400);
    echo '{"ok":false}';
    exit;
  }
  if (!in_array($body['key'], $KEYS, true)) {
    http_response_code(403);
    echo '{"ok":false}';
    exit;
  }
  $all = load_all($FILE);
  $cur = isset($all[$body['key']]) ? $all[$body['key']] : null;
  if ($cur === null || intval($body['t']) >= intval($cur['t'])) {
    $all[$body['key']] = array('t' => intval($body['t']), 'd' => $body['d']);
    if (save_all($FILE, $all)) {
      echo '{"ok":true}';
    } else {
      http_response_code(500);
      echo '{"ok":false,"err":"cannot_write"}';
    }
  } else {
    echo '{"ok":true}';
  }
  exit;
}

http_response_code(405);
echo '{"ok":false}';
