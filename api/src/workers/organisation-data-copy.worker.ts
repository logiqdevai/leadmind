import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ORGANISATION_DATA_COPY_QUEUE } from '@/core/queues/queues.constants';
import {
    OrganisationDataCopyJobData,
    OrganisationDataCopyService,
} from '@/modules/organisations/services/organisation-data-copy.service';

@Processor(ORGANISATION_DATA_COPY_QUEUE)
export class OrganisationDataCopyWorker extends WorkerHost {
    private readonly logger = new Logger(OrganisationDataCopyWorker.name);

    constructor(private readonly copyService: OrganisationDataCopyService) {
        super();
    }

    async process(job: Job<OrganisationDataCopyJobData>): Promise<void> {
        this.logger.log(
            `Copying data source=${job.data.sourceOrganisationUuid} target=${job.data.targetOrganisationUuid} categories=${job.data.categories.join(',')}`,
        );
        await this.copyService.runCopy(job.data);
    }
}
