import { HighestCapacitySelectionStrategy } from './highest-capacity-selection.strategy';

describe('HighestCapacitySelectionStrategy', () => {
    const strategy = new HighestCapacitySelectionStrategy();

    it('picks the candidate with the most remaining capacity', () => {
        const result = strategy.select([
            { campaign_integration_uuid: 'a', stage_remaining: 5 },
            { campaign_integration_uuid: 'b', stage_remaining: 12 },
            { campaign_integration_uuid: 'c', stage_remaining: 3 },
        ]);
        expect(result?.campaign_integration_uuid).toBe('b');
    });

    it('excludes candidates with no remaining capacity', () => {
        const result = strategy.select([
            { campaign_integration_uuid: 'a', stage_remaining: 0 },
            { campaign_integration_uuid: 'b', stage_remaining: 0 },
        ]);
        expect(result).toBeNull();
    });

    it('breaks ties deterministically by uuid', () => {
        const result = strategy.select([
            { campaign_integration_uuid: 'zzz', stage_remaining: 5 },
            { campaign_integration_uuid: 'aaa', stage_remaining: 5 },
        ]);
        expect(result?.campaign_integration_uuid).toBe('aaa');
    });

    it('returns null for an empty candidate list', () => {
        expect(strategy.select([])).toBeNull();
    });
});
