import { Controller, Get, Post, Body, Param, Put, Delete, Header, Req } from '@nestjs/common';
import { StoreService } from './store.service';
import { CreateStoreDto } from './dto/create-store.dto';
import { UpdateStoreDto } from './dto/update-store.dto';

@Controller('stores')
export class StoreController {
  constructor(private readonly svc: StoreService) {}

  @Post()
  create(@Body() dto: CreateStoreDto) {
    return this.svc.create(dto);
  }

  @Get()
  findAll() {
    return this.svc.findAll();
  }

  @Get('mine')
  findMine(@Req() req: any) {
    const u = req?.user || {}; // { username, role }
    return this.svc.findAllAssignedTo(u.username || '');
  }

  @Get('export-template')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  exportTemplate() {
    return this.svc.exportTemplateCSV();
  }

  @Get('export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async exportAll() {
    return await this.svc.exportCSV();
  }

  @Post('import')
  async import(@Body() body: { csv: string; createUsers?: boolean; defaultPassword?: string; defaultRole?: 'admin'|'user'|'ts'; upsert?: boolean }) {
    const { csv, createUsers, defaultPassword, defaultRole, upsert } = body || ({} as any);
    return this.svc.importFromCSV(String(csv || ''), { createUsers, defaultPassword, defaultRole, upsert });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.svc.findOne(Number(id));
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateStoreDto) {
    return this.svc.update(Number(id), dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.svc.remove(Number(id));
  }
}
