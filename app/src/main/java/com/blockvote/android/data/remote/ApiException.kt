package com.blockvote.android.data.remote

import java.io.IOException

class ApiException(
    message: String,
    val code: Int = -1
) : IOException(message)
