PUBLIC CLASS Hello EXTENDS wydgit.core/section
    META Id = "example/hello"
    PUBLIC PROPERTY Message AS String = "Ready."
    PUBLIC SUB Greet()
        Me.Message = "Hello from SEWN!"
    END SUB
    PRESENTATION CLIENT
        HEADING "Hello Wydgit"
        BUTTON Greet LABEL "Say hello" CALL Greet
        STATUS Message VALUE Me.Message
    END PRESENTATION
END CLASS
