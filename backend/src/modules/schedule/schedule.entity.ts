import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';
import { Store } from '../store/store.entity';

@Entity()
export class Schedule {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column()
  title: string;

  @Index()
  @Column('timestamp')
  start: Date;

  @Column('timestamp', { nullable: true })
  end: Date;

  @Index()
  @Column({ default: 'scheduled' })
  status: string;

  @Index()
  @Column({ nullable: true })
  assignedTs: string;

  @Index()
  @Column({ nullable: true })
  storeId: number;

  @Column('timestamp', { nullable: true })
  completedAt: Date | null;
}
