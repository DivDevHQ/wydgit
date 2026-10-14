PUBLIC CLASS TaskCard EXTENDS wydgit.core/block
    META Id = "divdev/task-card"
    PUBLIC PROPERTY content AS Object = {"type":"markdown","value":""}
    PUBLIC PROPERTY Title AS String = "Untitled"
    PUBLIC PROPERTY Complete AS Boolean = FALSE
    PUBLIC PROPERTY Rank AS Number = 0
    PUBLIC PROPERTY Tags AS Array = []
    PUBLIC PROPERTY Empty AS Null = NULL
    PRIVATE HIDDEN PROPERTY Cache AS Object = {}
    PUBLIC REQUIRED PROPERTY Key AS String
    PUBLIC EVENT Changed(Complete AS Boolean)

    PUBLIC VIRTUAL FUNCTION IsComplete() AS Boolean
        RETURN Me.Complete
    END FUNCTION

    PUBLIC SUB SetComplete(value AS Boolean)
        Me.Complete = value
    END SUB

    PROTECTED OVERRIDE SUB Init()
        Me.[Cache] = {}
    END SUB
END CLASS
