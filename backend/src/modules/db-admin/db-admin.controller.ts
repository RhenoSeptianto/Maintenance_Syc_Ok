import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { DbAdminService } from './db-admin.service';

@Controller('db-admin')
@Roles('admin')
export class DbAdminController {
  constructor(private readonly svc: DbAdminService) {}

  @Get('tables')
  tables() {
    return { tables: this.svc.listTables() };
  }

  @Get(':table')
  list(
    @Param('table') table: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('search') search?: string,
  ) {
    return this.svc.list(table, { page: Number(page), pageSize: Number(pageSize), search });
  }

  @Post(':table')
  create(@Param('table') table: string, @Body() body: Record<string, any>) {
    return this.svc.create(table, body);
  }

  @Put(':table/:id')
  update(@Param('table') table: string, @Param('id') id: string, @Body() body: Record<string, any>) {
    return this.svc.update(table, Number(id), body);
  }

  @Delete(':table/:id')
  remove(@Param('table') table: string, @Param('id') id: string) {
    return this.svc.remove(table, Number(id));
  }

  @Post('maintenance/rebuild-assets')
  rebuildAssetsFromMaintenance(
    @Body() body: { storeId?: number; fromDate?: string; toDate?: string; dryRun?: boolean },
  ) {
    return this.svc.rebuildAssetsFromMaintenances({
      storeId: body?.storeId,
      fromDate: body?.fromDate,
      toDate: body?.toDate,
      dryRun: body?.dryRun ?? false,
    });
  }
}
