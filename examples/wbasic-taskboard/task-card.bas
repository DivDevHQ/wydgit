PUBLIC CLASS TaskCard EXTENDS wydgit.core/block
    META Id = "divdev/task-card"
    CONTENT MARKDOWN ""
    PUBLIC REQUIRED PROPERTY Key AS String
    PUBLIC REQUIRED PROPERTY Title AS String
    PUBLIC REQUIRED PROPERTY Status AS String ENUM ["Pending","Complete"]
    PUBLIC PROPERTY Stage AS String = "Constructed"
    PUBLIC PROPERTY InitCount AS Number = 0
    PROTECTED OVERRIDE SUB Init()
        Me.InitCount = Me.InitCount + 1
        Me.Stage = "Initialized"
    END SUB
    PROTECTED OVERRIDE SUB Preload()
        Me.Stage = "Preloaded"
    END SUB
    PROTECTED OVERRIDE SUB Render()
        Me.Stage = "Rendered"
    END SUB
    PROTECTED OVERRIDE SUB Unload()
        Me.Stage = "Unloaded"
    END SUB
    PROTECTED OVERRIDE SUB Dispose()
        Me.Stage = "Disposed"
    END SUB
    PRESENTATION SERVER
        HEADING Me.Title
        CONTENT Me.Status
    END PRESENTATION
END CLASS
