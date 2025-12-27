import { Controller, Get, Post, Body, Param, Put, Delete, BadRequestException, ParseIntPipe } from '@nestjs/common';
import { ScheduleService } from './schedule.service';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { RescheduleDto } from './dto/reschedule.dto';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('schedules')
export class ScheduleController {
  constructor(private readonly svc: ScheduleService) {}

  @Post()
  create(@Body() dto: CreateScheduleDto) {
    const payload: any = { ...dto };
    if (dto.start) payload.start = new Date(dto.start);
    if (dto.end) payload.end = new Date(dto.end);
    return this.svc.create(payload);
  }

  @Get()
  findAll() {
    return this.svc.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.svc.findOne(Number(id));
  }

  @Get('upcoming')
  findUpcoming() {
    return this.svc.findUpcoming();
  }

  @Get('pending')
  findPending() {
    return this.svc.findByStatus('pending');
  }

  @Get('overdue')
  findOverdue() {
    return this.svc.findOverdue();
  }

  @Put(':id/reschedule')
  reschedule(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: RescheduleDto,
  ) {
    const { start } = body;
    const dt = new Date(start);
    if (!start || isNaN(dt.getTime())) throw new BadRequestException('Invalid start date');
    return this.svc.reschedule(id, dt);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateScheduleDto) {
    const payload: any = { ...dto };
    if (dto.start) payload.start = new Date(dto.start);
    if (dto.end) payload.end = new Date(dto.end);
    return this.svc.update(Number(id), payload);
  }

  @Put(':id/approve')
  @Roles('admin')
  approve(@Param('id') id: string) {
    return this.svc.update(Number(id), { status: 'approved' });
  }

  @Put(':id/reject')
  @Roles('admin')
  reject(@Param('id') id: string) {
    return this.svc.update(Number(id), { status: 'rejected' });
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.svc.remove(Number(id));
  }
}
