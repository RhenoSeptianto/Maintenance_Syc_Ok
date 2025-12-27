import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity()
export class Maintenance {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  details: string | null;

  @Column({ type: 'timestamp' })
  date: Date;

  @Column({ type: 'varchar', nullable: true })
  storeName: string | null;

  @Column({ type: 'varchar', nullable: true })
  technician: string | null;

  @Index()
  @Column({ type: 'int', nullable: true })
  storeId: number | null;

  @Index()
  @Column({ default: 'submitted' })
  status: string; // submitted | approved | rejected

  @Index()
  @Column({ type: 'varchar', nullable: true })
  submittedBy: string | null;

  @Column({ type: 'varchar', nullable: true })
  approvedBy: string | null;

  @Index()
  @Column({ type: 'int', nullable: true })
  scheduleId: number | null;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;
}
