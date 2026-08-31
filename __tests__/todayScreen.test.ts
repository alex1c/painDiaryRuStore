/**
 * Phase 3A Today screen helpers — history visibility and compact card summary.
 */

import initSqlJs from 'sql.js';

import { createDatabaseFromClient } from '@/src/db/database';
import { createSqlJsAdapter } from '@/src/db/sqlJsAdapter';
import type { SqlDatabase } from '@/src/db/types';
import { HeadacheRepository } from '@/src/repositories/HeadacheRepository';
import { buildCompactCardSummary } from '@/src/utils/detailsSummary';
import { getTodayHistorySectionMode } from '@/src/utils/todayHistorySection';

async function openTestDb(): Promise<SqlDatabase> {
	const SQL = await initSqlJs();
	const raw = new SQL.Database();
	return createDatabaseFromClient(createSqlJsAdapter(raw));
}

describe('getTodayHistorySectionMode', () => {
	test('hides section when active episode and no completed history', () => {
		expect(getTodayHistorySectionMode(true, 0)).toBe('hidden');
	});

	test('shows empty state when no active episode and no history', () => {
		expect(getTodayHistorySectionMode(false, 0)).toBe('empty');
	});

	test('shows list when completed episodes exist', () => {
		expect(getTodayHistorySectionMode(false, 2)).toBe('list');
		expect(getTodayHistorySectionMode(true, 1)).toBe('list');
	});
});

describe('buildCompactCardSummary', () => {
	test('returns null when no detail fields are set', async () => {
		const db = await openTestDb();
		const repo = new HeadacheRepository(db);
		const { episode } = repo.startEpisode({
			intensity: 5,
			startedAt: '2024-07-01T10:00:00.000Z',
		});

		const details = repo.getEpisodeDetails(episode.id);
		expect(details).not.toBeNull();
		expect(buildCompactCardSummary(details!)).toBeNull();
	});

	test('prefers side, first location, and first pain character', async () => {
		const db = await openTestDb();
		const repo = new HeadacheRepository(db);
		const { episode } = repo.startEpisode({
			intensity: 7,
			startedAt: '2024-07-01T10:00:00.000Z',
		});

		repo.replaceEpisodeDetails(episode.id, {
			side: 'right',
			locations: [{ code: 'temple' }],
			painCharacters: [{ code: 'throbbing' }],
			symptoms: [{ code: 'nausea' }],
			factors: [{ code: 'stress' }],
		});

		const details = repo.getEpisodeDetails(episode.id);
		expect(buildCompactCardSummary(details!)).toBe(
			'Справа · Висок · Пульсирует'
		);
	});

	test('omits missing values gracefully', async () => {
		const db = await openTestDb();
		const repo = new HeadacheRepository(db);
		const { episode } = repo.startEpisode({
			intensity: 4,
			startedAt: '2024-07-01T10:00:00.000Z',
		});

		repo.replaceEpisodeDetails(episode.id, {
			side: null,
			locations: [{ code: 'forehead' }],
			painCharacters: [],
			symptoms: [],
			factors: [],
		});

		const details = repo.getEpisodeDetails(episode.id);
		expect(buildCompactCardSummary(details!)).toBe('Лоб');
	});
});
