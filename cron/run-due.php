<?php
/**
 * cron/run-due.php - runs every data source that is due, one after another,
 * within a time budget. Built for outside schedulers, since this hosting
 * package has no cron:
 *   - the GitHub Actions workflow in .github/workflows/refresh-data.yml
 *   - the Docker container in docker/
 * Both call this same page, with the secret from includes/config.php
 * ('cron_http_secret') in an X-Cron-Secret header.
 *
 * Why several callers stay in sync:
 *   - "Due" is worked out from ingest_log, the same record the page-load
 *     refresh uses. Whoever runs a source first updates it; every other
 *     caller (another scheduler, or a visitor's page load) then finds it
 *     not due and does nothing.
 *   - Each source runs under the same MySQL lock as the page-load refresh
 *     (ukgrid_refresh_<SOURCE>), so two callers can never fetch the same
 *     source at the same moment.
 *   - Every write is INSERT ... ON DUPLICATE KEY UPDATE on the reading's
 *     own timestamp, so fetching the same half hour twice changes nothing.
 *
 * Output is plain text, one line per source, ending "done" - the GitHub
 * workflow and the container print it to their logs.
 */

require __DIR__ . '/_bootstrap.php';
ukgrid_out('run-due: starting');
require_once __DIR__ . '/../includes/refresh.php';
if (!function_exists('ukgrid_refresh_schedule') || !function_exists('ukgrid_ingest_battery')) {
    http_response_code(500);
    ukgrid_out('includes/refresh.php or includes/battery.php on the server is out of date: upload both from this version.');
    exit;
}

$config = ukgrid_load_config();
$pdo = ukgrid_db();
$started = microtime(true);
$budget = (int) ($config['refresh']['run_due_budget_seconds'] ?? 45);
$caller = preg_replace('/[^a-z0-9_-]/i', '', (string) ($_GET['caller'] ?? ($isCli ? 'cli' : 'web')));

[$intervals, $timeouts] = ukgrid_refresh_schedule($config);
// NESO needs several discovery calls, so page loads leave it out; a
// scheduler can afford it.
if (!isset($intervals['NESO'])) $intervals['NESO'] = 30;

$due = ukgrid_refresh_overdue($pdo, $intervals);
ukgrid_file_log('run-due (' . $caller . '): ' . (count($due) ? implode(', ', array_keys($due)) . ' due' : 'nothing due'));
ukgrid_out('UK Grid: Live+ run-due, ' . gmdate('Y-m-d H:i:s') . ' UTC, caller ' . $caller);
if (!$due) {
    ukgrid_out('Nothing due.');
}

$lock = $pdo->prepare('SELECT GET_LOCK(?, 0)');
$release = $pdo->prepare('SELECT RELEASE_LOCK(?)');
foreach (array_keys($due) as $source) {
    if (microtime(true) - $started > $budget) {
        ukgrid_out('Stopped: time budget used. The rest run next time.');
        break;
    }
    $lockName = 'ukgrid_refresh_' . $source;
    $lock->execute([$lockName]);
    if ((int) $lock->fetchColumn() !== 1) {
        ukgrid_out($source . ': already running elsewhere, skipped.');
        continue;
    }
    $t = microtime(true);
    try {
        ukgrid_refresh_run_source($pdo, $config, $source, (int) ($timeouts[$source] ?? 10), true);
        $st = $pdo->prepare('SELECT status, rows_written FROM ingest_log WHERE source = ? ORDER BY ran_at DESC LIMIT 1');
        $st->execute([$source]);
        $last = $st->fetch() ?: [];
        ukgrid_out(sprintf('%s: %s, %s rows, %.1fs', $source, $last['status'] ?? '?', $last['rows_written'] ?? '?', microtime(true) - $t));
    } catch (Throwable $e) {
        ukgrid_log_ingest($source, 'ERROR', 0, 'run-due threw - ' . get_class($e) . ': ' . $e->getMessage());
        ukgrid_out($source . ': ERROR - ' . $e->getMessage());
    } finally {
        $release->execute([$lockName]);
    }
}
ukgrid_out(sprintf('done in %.1fs', microtime(true) - $started));
