import { Module } from '@nestjs/common';
import { ApifyModule } from '@/integrations/apify/apify.module';
import { ScrapioModule } from '@/integrations/scrapio/scrapio.module';
import { WebsiteScraperService } from './website-scraper.service';

@Module({
  imports: [ApifyModule, ScrapioModule],
  providers: [WebsiteScraperService],
  exports: [WebsiteScraperService, ScrapioModule],
})
export class WebsiteScraperModule {}
