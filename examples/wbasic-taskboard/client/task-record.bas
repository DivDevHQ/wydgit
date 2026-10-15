PUBLIC CLASS TaskRecord
    META Id = "divdev/task-record"
    PUBLIC REQUIRED PROPERTY Key AS String
    PUBLIC REQUIRED PROPERTY Title AS String
    PUBLIC REQUIRED PROPERTY Status AS String ENUM ["Pending","Complete"]
END CLASS
