type OutboxEvent = {
  _id: string;
  type: 'create' | 'update' | 'remove';
  data: any;
  diff?: any[];
  createdOn: number;
};

export default OutboxEvent;